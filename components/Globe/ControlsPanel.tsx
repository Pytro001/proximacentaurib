import type { SatelliteCatalogMode } from '../../lib/launches';
import styles from '../../styles/Globe.module.css';

interface ControlsPanelProps {
  showSatellites: boolean;
  setShowSatellites: (v: boolean) => void;
  showLaunches: boolean;
  setShowLaunches: (v: boolean) => void;
  showNightSide: boolean;
  setShowNightSide: (v: boolean) => void;
  satelliteCatalog: SatelliteCatalogMode;
  setSatelliteCatalog: (v: SatelliteCatalogMode) => void;
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
  satelliteCatalog,
  setSatelliteCatalog,
  mode = 'earth',
  globeId = 'earth',
  showSatellites,
  setShowSatellites,
  showLaunches,
  setShowLaunches,
  showNightSide,
  setShowNightSide,
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
      {globeId === 'earth' && mode !== 'orbiter' && (
        <div className={styles.controlsOptions}>
          <div className={styles.controlRow}>
            <span className={styles.controlLabel}>Satellites</span>
            <label className={styles.toggle} title="Show orbiting objects">
              <input
                type="checkbox"
                className={styles.toggleInput}
                checked={showSatellites}
                onChange={(e) => setShowSatellites(e.target.checked)}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>
          <div className={styles.controlRow}>
            <span className={styles.controlLabel}>Launches</span>
            <label className={styles.toggle} title="Launch site markers">
              <input
                type="checkbox"
                className={styles.toggleInput}
                checked={showLaunches}
                onChange={(e) => setShowLaunches(e.target.checked)}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>
          <div className={styles.controlRow}>
            <span className={styles.controlLabel}>Night side</span>
            <label className={styles.toggle} title="Day/night or night overlay">
              <input
                type="checkbox"
                className={styles.toggleInput}
                checked={showNightSide}
                onChange={(e) => setShowNightSide(e.target.checked)}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>
          <div className={styles.controlRow}>
            <span className={styles.controlLabel} title="All CelesTrak groups + debris (heavier)">
              Full catalog
            </span>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                className={styles.toggleInput}
                checked={satelliteCatalog === 'full'}
                onChange={(e) => setSatelliteCatalog(e.target.checked ? 'full' : 'lite')}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>
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
