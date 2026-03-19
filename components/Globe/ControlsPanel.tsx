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

const LEGEND_ITEMS: [string, string][] = [
  ['#ff6d00', 'Station'],
  ['#ef5350', 'Military'],
  ['#8899a6', 'Constellation'],
  ['#00c853', 'Navigation'],
  ['#1d9bf0', 'Weather'],
  ['#ffab00', 'Communications'],
  ['#4caf50', 'Earth Observation'],
  ['#e040fb', 'Science'],
  ['#ce93d8', 'Private'],
  ['#9c27b0', 'Cargo'],
  ['#2196f3', 'Crew'],
  ['#555555', 'Debris'],
  ['#546e7a', 'Other'],
];

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
          <span className={styles.infoCardLabel}>Tracked satellites</span>
          <span className={styles.infoCardValue}>{satelliteCount}</span>
        </div>
        <div className={styles.infoCard}>
          <span className={styles.infoCardLabel}>Launch sites</span>
          <span className={styles.infoCardValue}>{launchSiteCount}</span>
        </div>
      </div>
      {mode !== 'orbiter' && (
        <div className={styles.legend}>
          {LEGEND_ITEMS.map(([color, label]) => (
            <div key={label} className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: color }} />
              <span className={styles.legendLabel}>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
