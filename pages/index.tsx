import Head from 'next/head';
import dynamic from 'next/dynamic';
import styles from '../styles/Globe.module.css';

const SpaceGlobe = dynamic(() => import('../components/Globe/SpaceGlobe'), {
  ssr: false,
  loading: () => (
    <div className={styles.loading}>
      <div className={styles.spinner} />
      <p className={styles.loadingText}>Initializing globe...</p>
    </div>
  ),
});

export default function Home() {
  return (
    <>
      <Head>
        <title>Space Globe — Proxima Centauri B</title>
        <meta
          name="description"
          content="Real-time 3D globe tracking satellites, rocket launches, and orbital paths"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div className={styles.page}>
        <header className={styles.topNav}>
          <div className={styles.topNavInner}>
            <div className={styles.logo}>
              <img src="/logo-proxima.png" alt="PROXIMA" />
            </div>
          </div>
        </header>
        <SpaceGlobe />
      </div>
    </>
  );
}
