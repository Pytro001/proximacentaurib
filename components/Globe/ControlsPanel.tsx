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
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className={styles.controlRow}>
      <span className={styles.controlLabel}>{label}</span>
      <label className={styles.toggle}>
        <input
          type="checkbox"
          className={styles.toggleInput}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className={styles.toggleSlider} />
      </label>
    </div>
  );
}

export default function ControlsPanel({
  showSatellites,
  setShowSatellites,
  showLaunches,
  setShowLaunches,
  showNightSide,
  setShowNightSide,
  satelliteCount,
  launchSiteCount,
}: ControlsPanelProps) {
  return (
    <div className={styles.controlsWrap}>
      <div className={styles.controls}>
        <h3 className={styles.controlsTitle}>Layers</h3>
        <Toggle
          label="Satellites"
          checked={showSatellites}
          onChange={setShowSatellites}
        />
        <Toggle
          label="Launches"
          checked={showLaunches}
          onChange={setShowLaunches}
        />
        <Toggle
          label="Night side"
          checked={showNightSide}
          onChange={setShowNightSide}
        />
      </div>
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
    </div>
  );
}
