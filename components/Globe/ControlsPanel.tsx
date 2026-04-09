import styles from '../../styles/Globe.module.css';

interface ControlsPanelProps {
  satelliteCount: number;
  launchSiteCount: number;
  mode?: 'earth' | 'orbiter';
  satellitesEnabled: boolean;
  onSatellitesEnabledChange: (enabled: boolean) => void;
  satellitesLoading?: boolean;
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
  satellitesEnabled,
  onSatellitesEnabledChange,
  satellitesLoading = false,
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
        <div className={styles.satOrbitRow}>
          <button
            type="button"
            className={`${styles.satOrbitBtn} ${satellitesEnabled ? styles.satOrbitBtnOn : ''}`}
            aria-pressed={satellitesEnabled}
            aria-label={satellitesEnabled ? 'Satellite orbit view on' : 'Satellite orbit view off'}
            title="Show orbiting satellites on the globe. Loads the full CelesTrak catalog (heavier). Off by default for faster startup."
            disabled={satellitesLoading}
            onClick={() => onSatellitesEnabledChange(!satellitesEnabled)}
          >
            <svg className={styles.satOrbitIcon} viewBox="0 0 24 24" aria-hidden>
              <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="10" width="5" height="4" rx="1" />
                <rect x="16" y="10" width="5" height="4" rx="1" />
                <rect x="10" y="10.5" width="4" height="3" rx="0.75" />
                <path d="M12 6v3.5M12 14.5V18M2 12h2M20 12h2" />
              </g>
            </svg>
            <span className={styles.satOrbitHint}>Orbit</span>
          </button>
          {satellitesLoading && <span className={styles.satToggleSpinner} aria-hidden />}
        </div>
      )}
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
