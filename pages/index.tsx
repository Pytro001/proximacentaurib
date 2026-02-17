import Head from 'next/head'
import styles from '../styles/Home.module.css'

export default function Home() {
  return (
    <>
      <Head>
        <title>Proxima Centauri B</title>
        <meta name="description" content="Proxima Centauri B - PEAK M Industries" />
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
          <div className={styles.heroContent} />
        </section>

        {/* Footer */}
        <footer className={styles.footer}>
          <p className={styles.footerText}>
            Designed by Konstantin Saifoulline in 2026 © Rights Reserved
          </p>
        </footer>
      </div>
    </>
  )
}
