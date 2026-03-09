import styles from '../../styles/Globe.module.css';
import { SatellitePosition } from '../../lib/satellites';
import { Launch, formatLaunchDate, getLaunchStatusColor } from '../../lib/launches';

interface InfoPanelProps {
  satellite: SatellitePosition | null;
  launch: Launch | null;
  onClose: () => void;
}

function SatelliteInfo({ sat }: { sat: SatellitePosition }) {
  return (
    <div className={styles.infoPanelBody}>
      <div className={styles.categoryTag}>{sat.category}</div>

      <div className={styles.dataField}>
        <span className={styles.dataLabel}>NORAD ID</span>
        <span className={styles.dataValueMono}>{sat.noradId}</span>
      </div>

      <div className={styles.dataField}>
        <span className={styles.dataLabel}>Orbit Type</span>
        <span className={styles.dataValue}>{sat.orbitType}</span>
      </div>

      <div className={styles.divider} />

      <div className={styles.dataField}>
        <span className={styles.dataLabel}>Altitude</span>
        <span className={styles.dataValueMono}>
          {sat.alt.toFixed(1)} km
        </span>
      </div>

      <div className={styles.dataField}>
        <span className={styles.dataLabel}>Velocity</span>
        <span className={styles.dataValueMono}>
          {sat.velocity.toFixed(2)} km/s
        </span>
      </div>

      <div className={styles.dataField}>
        <span className={styles.dataLabel}>Inclination</span>
        <span className={styles.dataValueMono}>
          {sat.inclination.toFixed(2)}°
        </span>
      </div>

      <div className={styles.dataField}>
        <span className={styles.dataLabel}>Period</span>
        <span className={styles.dataValueMono}>
          {sat.period.toFixed(1)} min
        </span>
      </div>

      <div className={styles.dataField}>
        <span className={styles.dataLabel}>Eccentricity</span>
        <span className={styles.dataValueMono}>
          {sat.eccentricity.toFixed(6)}
        </span>
      </div>

      <div className={styles.divider} />

      <div className={styles.dataField}>
        <span className={styles.dataLabel}>Position</span>
        <span className={styles.dataValueMono}>
          {sat.lat.toFixed(4)}° N, {sat.lng.toFixed(4)}° E
        </span>
      </div>
    </div>
  );
}

function LaunchInfo({ launch }: { launch: Launch }) {
  const statusColor = getLaunchStatusColor(launch.status);

  return (
    <div className={styles.infoPanelBody}>
      <div
        className={styles.statusBadge}
        style={{
          background: `${statusColor}20`,
          color: statusColor,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: statusColor,
            display: 'inline-block',
          }}
        />
        {launch.status}
      </div>

      <div className={styles.dataField}>
        <span className={styles.dataLabel}>Rocket</span>
        <span className={styles.dataValue}>{launch.rocket}</span>
      </div>

      <div className={styles.dataField}>
        <span className={styles.dataLabel}>Provider</span>
        <span className={styles.dataValue}>{launch.provider}</span>
      </div>

      <div className={styles.divider} />

      <div className={styles.dataField}>
        <span className={styles.dataLabel}>Launch Date</span>
        <span className={styles.dataValueMono}>
          {formatLaunchDate(launch.net)}
        </span>
      </div>

      {launch.orbitName && (
        <div className={styles.dataField}>
          <span className={styles.dataLabel}>Target Orbit</span>
          <span className={styles.dataValue}>{launch.orbitName}</span>
        </div>
      )}

      <div className={styles.dataField}>
        <span className={styles.dataLabel}>Launch Pad</span>
        <span className={styles.dataValue}>{launch.padName}</span>
      </div>

      <div className={styles.dataField}>
        <span className={styles.dataLabel}>Location</span>
        <span className={styles.dataValue}>{launch.padLocation}</span>
      </div>

      {launch.missionDescription && (
        <>
          <div className={styles.divider} />
          <div className={styles.dataField}>
            <span className={styles.dataLabel}>Mission</span>
            <span className={styles.dataValue} style={{ lineHeight: 1.5 }}>
              {launch.missionDescription}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

export default function InfoPanel({ satellite, launch, onClose }: InfoPanelProps) {
  const isOpen = !!(satellite || launch);
  const title = satellite?.name || launch?.mission || '';

  return (
    <div className={`${styles.infoPanel} ${isOpen ? styles.infoPanelOpen : ''}`}>
      <div className={styles.infoPanelHeader}>
        <h2 className={styles.infoPanelTitle}>{title}</h2>
        <button className={styles.closeBtn} onClick={onClose}>
          ✕
        </button>
      </div>
      {satellite && <SatelliteInfo sat={satellite} />}
      {launch && <LaunchInfo launch={launch} />}
    </div>
  );
}
