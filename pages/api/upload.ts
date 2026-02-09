import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import formidable from 'formidable'
import fs from 'fs'

// Disable the default body parser
export const config = {
  api: {
    bodyParser: false,
  },
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables')
}

// Create Supabase client with service role key for admin operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
      keepExtensions: true,
    })

    const formData = await form.parse(req)
    const files = formData[1]
    
    if (!files || !files.file) {
      return res.status(400).json({ error: 'No file provided' })
    }

    const fileArray = Array.isArray(files.file) ? files.file : [files.file]
    
    if (fileArray.length === 0) {
      return res.status(400).json({ error: 'No file provided' })
    }

    const file = fileArray[0]
    
    if (!file || !file.filepath) {
      return res.status(400).json({ error: 'Invalid file' })
    }

    // Read the file
    const fileBuffer = fs.readFileSync(file.filepath)
    const originalName = file.originalFilename || 'upload'
    const fileName = `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    const fileExt = fileName.split('.').pop()
    const bucketName = 'design-uploads'

    // Check if bucket exists, create if it doesn't
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets()
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName)
    
    if (!bucketExists) {
      console.log('Creating bucket:', bucketName)
      const { data: newBucket, error: createError } = await supabaseAdmin.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 10485760, // 10MB
      })
      
      if (createError) {
        console.error('Bucket creation error:', createError)
        return res.status(500).json({ 
          error: 'Failed to create storage bucket', 
          details: createError.message 
        })
      }
    }

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(fileName, fileBuffer, {
        contentType: file.mimetype || `application/${fileExt}`,
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return res.status(500).json({ error: 'Failed to upload file', details: uploadError.message })
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(fileName)

    // Insert record into database
    const { data: dbData, error: dbError } = await supabaseAdmin
      .from('design_submissions')
      .insert({
        file_name: fileName,
        original_name: originalName,
        file_url: urlData.publicUrl,
        file_size: file.size || 0,
        file_type: file.mimetype || `application/${fileExt}`,
        uploaded_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      // Try to delete the uploaded file if database insert fails
      await supabaseAdmin.storage.from(bucketName).remove([fileName])
      return res.status(500).json({ error: 'Failed to save record', details: dbError.message })
    }

    // Clean up temporary file
    fs.unlinkSync(file.filepath)

    return res.status(200).json({
      success: true,
      data: dbData,
      url: urlData.publicUrl,
    })
  } catch (error: any) {
    console.error('Upload handler error:', error)
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}
