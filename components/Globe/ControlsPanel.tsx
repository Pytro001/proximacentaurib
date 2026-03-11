import styles from '../../styles/Globe.module.css';

interface ControlsPanelProps {
  showSatellites: boolean;
  setShowSatellites: (v: boolean) => void;
  showLaunches: boolean;
  setShowLaunches: (v: boolean) => void;
  showNightSide: boolean;
  setShowNightSide: (v: boolean) => void;
  satelliteCount: number;
  launchSiteCount: number;
  mode?: 'earth' | 'orbiter';
  globeId?: string;
}

function getOrbiterLabel(globeId: string): string {
  if (globeId === 'moon') return 'Moon orbiters';
  if (globeId === 'mars') return 'Mars orbiters';
  return 'Orbiters';
}

export default function ControlsPanel({
  satelliteCount,
  launchSiteCount,
  mode = 'earth',
  globeId = 'earth',
  ..._rest
}: ControlsPanelProps) {
  return (
    <div className={styles.controlsWrap}>
      <div className={styles.infoStrip}>
        <div className={styles.infoCard}>
          <span className={styles.infoCardLabel}>{mode === 'orbiter' ? getOrbiterLabel(globeId) : 'Tracked satellites'}</span>
          <span className={styles.infoCardValue}>{satelliteCount}</span>
        </div>
        <div className={styles.infoCard}>
          <span className={styles.infoCardLabel}>Launch sites</span>
          <span className={styles.infoCardValue}>{launchSiteCount}</span>
        </div>
      </div>
    </div>
  );
}
