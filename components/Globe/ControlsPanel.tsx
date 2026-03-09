import styles from '../../styles/Globe.module.css';

interface ControlsPanelProps {
  showSatellites: boolean;
  setShowSatellites: (v: boolean) => void;
  showOrbits: boolean;
  setShowOrbits: (v: boolean) => void;
  showLaunches: boolean;
  setShowLaunches: (v: boolean) => void;
  showNightSide: boolean;
  setShowNightSide: (v: boolean) => void;
  satelliteCount: number;
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
  showOrbits,
  setShowOrbits,
  showLaunches,
  setShowLaunches,
  showNightSide,
  setShowNightSide,
  satelliteCount,
}: ControlsPanelProps) {
  return (
    <div className={styles.controls}>
      <h3 className={styles.controlsTitle}>Layers</h3>
      <Toggle
        label="Satellites"
        checked={showSatellites}
        onChange={setShowSatellites}
      />
      <Toggle
        label="Orbit paths"
        checked={showOrbits}
        onChange={setShowOrbits}
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
      {showSatellites && satelliteCount > 0 && (
        <div className={styles.badge}>
          <span className={styles.badgeDot} />
          {satelliteCount} tracked
        </div>
      )}
    </div>
  );
}
