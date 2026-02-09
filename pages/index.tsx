import Head from 'next/head'
import { useState } from 'react'
import styles from '../styles/Home.module.css'

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<'success' | 'error' | null>(null)
  const [statusMessage, setStatusMessage] = useState('')

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setSelectedFile(file)
      setUploadStatus(null)
      setStatusMessage('')

      // Automatically upload when file is selected
      await uploadFile(file)
    }
  }

  const uploadFile = async (file: File) => {
    setUploading(true)
    setUploadStatus(null)
    setStatusMessage('Uploading...')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMsg = data.details ? `${data.error}: ${data.details}` : (data.error || 'Upload failed')
        throw new Error(errorMsg)
      }

      setUploadStatus('success')
      setStatusMessage('Thanks for contributing with your design idea!')
      setSelectedFile(null)
      
      // Reset file input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement
      if (fileInput) {
        fileInput.value = ''
      }
    } catch (error: any) {
      console.error('Upload error:', error)
      setUploadStatus('error')
      setStatusMessage(error.message || 'Failed to upload. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Proxima Centauri B</title>
        <meta name="description" content="Proxima Centauri B - Upload your design ideas" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/favicon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>
      
      <div className={styles.container}>
        {/* Logo */}
        <div className={styles.logo}>
          <img src="/logo.png" alt="PEAK M Logo" />
        </div>
        
        {/* Hero Section */}
        <section className={styles.hero}>
          <div className={styles.backgroundDots}>
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={i} className={`${styles.star} ${styles[`star${i + 1}`]}`}></div>
            ))}
          </div>
          <div className={styles.heroContent}>
            <p className={styles.uploadText}>
              Here you can send your design idea :)
            </p>
            <label htmlFor="file-upload" className={`${styles.uploadButton} ${uploading ? styles.uploading : ''}`}>
              {uploading ? 'UPLOADING...' : 'UPLOAD DESIGN'}
              <input
                id="file-upload"
                type="file"
                accept="image/*,.pdf,.doc,.docx"
                onChange={handleFileChange}
                className={styles.fileInput}
                disabled={uploading}
              />
            </label>
            {selectedFile && !uploading && (
              <p className={styles.fileName}>{selectedFile.name}</p>
            )}
            {uploadStatus && (
              <p className={`${styles.statusMessage} ${styles[uploadStatus]}`}>
                {statusMessage}
              </p>
            )}
          </div>
        </section>

        {/* Footer */}
        <footer className={styles.footer}>
          <p className={styles.footerText}>
            Designed by Konstantin Saifoulline in 2026 <span className={styles.copyright}>©</span> Rights Reserved
          </p>
        </footer>
      </div>
    </>
  )
}
