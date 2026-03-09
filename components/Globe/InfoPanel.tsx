import styles from '../../styles/Globe.module.css';
import { SatellitePosition } from '../../lib/satellites';
import { Launch, formatLaunchDate, getLaunchStatusColor } from '../../lib/launches';

interface InfoPanelProps {
  satellite: SatellitePosition | null;
  launches: Launch[] | null;
  onClose: () => void;
}

function SatelliteInfo({ sat }: { sat: SatellitePosition }) {
  return (
    <div className={styles.infoPanelBody}>
      <div className={styles.categoryTag}>{sat.category}</div>

      {sat.useCase && (
        <div className={styles.dataField}>
          <span className={styles.dataLabel}>Use Case</span>
          <span className={styles.dataValue} style={{ lineHeight: 1.5 }}>{sat.useCase}</span>
        </div>
      )}

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
    <div className={styles.dataField} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: statusColor,
            flexShrink: 0,
          }}
        />
        <span className={styles.dataValue} style={{ fontWeight: 600 }}>{launch.name}</span>
      </div>
      <div className={styles.dataField}>
        <span className={styles.dataLabel}>Date</span>
        <span className={styles.dataValueMono}>{formatLaunchDate(launch.net)}</span>
      </div>
      <div className={styles.dataField}>
        <span className={styles.dataLabel}>Rocket</span>
        <span className={styles.dataValue}>{launch.rocket}</span>
      </div>
      <div className={styles.dataField}>
        <span className={styles.dataLabel}>Status</span>
        <span className={styles.dataValue} style={{ color: statusColor }}>{launch.status}</span>
      </div>
      {launch.vidUrls && launch.vidUrls.length > 0 && (
        <div className={styles.dataField}>
          <span className={styles.dataLabel}>Livestream</span>
          {launch.vidUrls.map((v, i) => (
            <a
              key={i}
              href={v.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.dataValue}
              style={{ color: '#1d9bf0', textDecoration: 'underline', display: 'block' }}
            >
              {v.title || 'Watch'}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function LaunchLocationInfo({ launches }: { launches: Launch[] }) {
  const locationName = launches[0]?.padLocation || launches[0]?.padName || 'Launch site';

  return (
    <div className={styles.infoPanelBody}>
      <div className={styles.dataField}>
        <span className={styles.dataLabel}>Location</span>
        <span className={styles.dataValue}>{locationName}</span>
      </div>
      <div className={styles.dataField}>
        <span className={styles.dataLabel}>Upcoming launches</span>
        <span className={styles.dataValueMono}>{launches.length}</span>
      </div>
      <div className={styles.divider} />
      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
        {launches.map((launch) => (
          <LaunchInfo key={launch.id} launch={launch} />
        ))}
      </div>
    </div>
  );
}

export default function InfoPanel({ satellite, launches, onClose }: InfoPanelProps) {
  const isOpen = !!(satellite || (launches && launches.length > 0));
  const title = satellite?.name || (launches?.length ? `${launches[0]?.padLocation || 'Launch site'} (${launches.length} launches)` : '');

  return (
    <div className={`${styles.infoPanel} ${isOpen ? styles.infoPanelOpen : ''}`}>
      <div className={styles.infoPanelHeader}>
        <h2 className={styles.infoPanelTitle}>{title}</h2>
        <button className={styles.closeBtn} onClick={onClose}>
          ✕
        </button>
      </div>
      {satellite && <SatelliteInfo sat={satellite} />}
      {launches && launches.length > 0 && <LaunchLocationInfo launches={launches} />}
    </div>
  );
}
