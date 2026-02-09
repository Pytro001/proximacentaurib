import Head from 'next/head'
import Link from 'next/link'
import styles from '../styles/Home.module.css'

export default function Custom404() {
  return (
    <>
      <Head>
        <title>404 - Page Not Found | PEAK M</title>
      </Head>
      
      <div className={styles.container}>
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <h1 className={styles.uploadText}>404 - Page Not Found</h1>
            <p className={styles.uploadText}>
              The page you're looking for doesn't exist.
            </p>
            <Link href="/" className={styles.uploadButton}>
              Go Home
            </Link>
          </div>
        </section>
      </div>
    </>
  )
}