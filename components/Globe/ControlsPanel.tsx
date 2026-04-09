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
        <div className={styles.satelliteToggleRow}>
          <span className={styles.satelliteToggleLabel} title="Loads full CelesTrak catalog (~heavy). Off by default for faster startup.">
            Satellites
          </span>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={satellitesEnabled}
              disabled={satellitesLoading}
              onChange={(e) => onSatellitesEnabledChange(e.target.checked)}
            />
            <span className={styles.toggleSlider} />
          </label>
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
