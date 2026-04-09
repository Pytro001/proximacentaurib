import styles from '../../styles/Globe.module.css';

export type PlanetBodyId = 'earth' | 'moon' | 'mars';

interface ControlsPanelProps {
  body: PlanetBodyId;
  satelliteCount: number;
  launchSiteCount: number;
  overlayEnabled: boolean;
  onOverlayEnabledChange: (enabled: boolean) => void;
  overlayLoading?: boolean;
}

export default function ControlsPanel({
  body,
  satelliteCount,
  launchSiteCount,
  overlayEnabled,
  onOverlayEnabledChange,
  overlayLoading = false,
}: ControlsPanelProps) {
  const isEarth = body === 'earth';
  const labelOff = isEarth ? 'Activate satellites' : 'Activate orbiters';
  const labelOn = isEarth ? 'Satellites on' : 'Orbiters on';

  return (
    <div className={styles.controlsWrap}>
      <div className={styles.statsPlain}>
        <div className={styles.statsPlainRow}>
          <span className={styles.statsPlainLabel}>
            {isEarth ? 'Tracked satellites' : 'Orbiters'}
          </span>
          <span className={styles.statsPlainValue}>{satelliteCount}</span>
        </div>
        {isEarth && (
          <div className={styles.statsPlainRow}>
            <span className={styles.statsPlainLabel}>Launch sites</span>
            <span className={styles.statsPlainValue}>{launchSiteCount}</span>
          </div>
        )}
      </div>
      <div className={styles.satToggleRow}>
        <button
          type="button"
          className={`${styles.satToggleBtn} ${overlayEnabled ? styles.satToggleBtnOn : ''}`}
          aria-pressed={overlayEnabled}
          aria-label={overlayEnabled ? labelOn : labelOff}
          title={
            isEarth
              ? 'Download satellite catalog and show objects in Earth orbit (heavy).'
              : 'Show major orbiters around this body.'
          }
          disabled={overlayLoading}
          onClick={() => onOverlayEnabledChange(!overlayEnabled)}
        >
          {overlayEnabled ? labelOn : labelOff}
        </button>
        {overlayLoading && <span className={styles.satToggleSpinner} aria-hidden />}
      </div>
    </div>
  );
}
