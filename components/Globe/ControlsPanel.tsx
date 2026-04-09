import styles from '../../styles/Globe.module.css';

interface ControlsPanelProps {
  satelliteCount: number;
  launchSiteCount: number;
  mode?: 'earth' | 'orbiter';
  satellitesEnabled: boolean;
  onSatellitesEnabledChange: (enabled: boolean) => void;
  satellitesLoading?: boolean;
}

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
      {mode !== 'orbiter' && (
        <div className={styles.satToggleRow}>
          <button
            type="button"
            className={`${styles.satToggleBtn} ${satellitesEnabled ? styles.satToggleBtnOn : ''}`}
            aria-pressed={satellitesEnabled}
            aria-label={satellitesEnabled ? 'Satellites on' : 'Satellites off'}
            title="Load and show Earth satellites on the globe (full catalog; heavier). Off by default."
            disabled={satellitesLoading}
            onClick={() => onSatellitesEnabledChange(!satellitesEnabled)}
          >
            Satellite
          </button>
          {satellitesLoading && <span className={styles.satToggleSpinner} aria-hidden />}
        </div>
      )}
      <div className={styles.statsPlain}>
        <div className={styles.statsPlainRow}>
          <span className={styles.statsPlainLabel}>
            {mode === 'orbiter' ? 'Orbiters' : 'Tracked satellites'}
          </span>
          <span className={styles.statsPlainValue}>{satelliteCount}</span>
        </div>
        {mode !== 'orbiter' && (
          <div className={styles.statsPlainRow}>
            <span className={styles.statsPlainLabel}>Launch sites</span>
            <span className={styles.statsPlainValue}>{launchSiteCount}</span>
          </div>
        )}
      </div>
    </div>
  );
}
