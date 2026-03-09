import { useState, useEffect } from 'react';
import styles from '../../styles/Globe.module.css';
import { SatellitePosition } from '../../lib/satellites';
import { Launch, formatLaunchDate, getLaunchStatusColor, getCountdown } from '../../lib/launches';

interface InfoPanelProps {
  satellite: SatellitePosition | null;
  launches: Launch[] | null;
  upcomingLaunches: Launch[];
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

function CountdownDisplay({ net }: { net: string }) {
  const [cd, setCd] = useState(() => getCountdown(net));
  useEffect(() => {
    const t = setInterval(() => setCd(getCountdown(net)), 1000);
    return () => clearInterval(t);
  }, [net]);
  if (cd.past) return <span className={styles.countdownText}>Liftoff!</span>;
  const parts = [
    cd.days > 0 && `${cd.days}d`,
    `${String(cd.hours).padStart(2, '0')}h`,
    `${String(cd.mins).padStart(2, '0')}m`,
    `${String(cd.secs).padStart(2, '0')}s`,
  ].filter(Boolean);
  return <span className={styles.countdownText}>{parts.join(' ')}</span>;
}

function LaunchInfo({
  launch,
  isNext,
  isExpanded,
  onToggle,
}: {
  launch: Launch;
  isNext?: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const statusColor = getLaunchStatusColor(launch.status);

  return (
    <div className={styles.launchCard}>
      <button className={styles.launchHeaderButton} onClick={onToggle} type="button">
        <div className={styles.launchCardHeader}>
        {isNext && <span className={styles.nextBadge}>NEXT</span>}
        <span className={styles.launchDot} style={{ background: statusColor }} />
        <span className={styles.launchName}>{launch.name}</span>
        <span className={styles.expandIcon}>{isExpanded ? '−' : '+'}</span>
        </div>
      </button>
      {isNext ? (
        <div className={styles.countdownBlock}>
          <CountdownDisplay net={launch.net} />
        </div>
      ) : (
        <div className={styles.launchDate}>{formatLaunchDate(launch.net)}</div>
      )}
      <div className={styles.launchMeta}>
        <span>{launch.rocket}</span>
        {launch.padLocation && <span> · {launch.padLocation}</span>}
      </div>
      {isExpanded && (
        <div className={styles.launchDetails}>
          <div className={styles.dataField}>
            <span className={styles.dataLabel}>Status</span>
            <span className={styles.dataValue} style={{ color: statusColor }}>{launch.status}</span>
          </div>
          {!!launch.missionDescription && (
            <div className={styles.dataField}>
              <span className={styles.dataLabel}>Mission</span>
              <span className={styles.dataValue}>
                {launch.missionDescription.length > 180
                  ? `${launch.missionDescription.slice(0, 180)}...`
                  : launch.missionDescription}
              </span>
            </div>
          )}
        </div>
      )}
      {isExpanded && launch.vidUrls && launch.vidUrls.length > 0 && (
        <div className={styles.videoLinks}>
          {launch.vidUrls.slice(0, 2).map((v, i) => {
            const isYt = (v.source || v.url || '').toLowerCase().includes('youtube');
            const label = v.title || (v.isLive ? 'Livestream' : (isYt ? 'YouTube' : 'Watch'));
            return (
              <a key={i} href={v.url} target="_blank" rel="noopener noreferrer" className={styles.videoLink}>
                <span>{isYt ? '▶' : '🔗'}</span> {label}
              </a>
            );
          })}
        </div>
      )}
      {isExpanded && launch.externalLinks && launch.externalLinks.length > 0 && (
        <div className={styles.videoLinks}>
          {launch.externalLinks.slice(0, 2).map((link, i) => (
            <a key={`ext-${i}`} href={link.url} target="_blank" rel="noopener noreferrer" className={styles.videoLink}>
              <span>🌐</span> {link.title}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function LaunchCards({ launches }: { launches: Launch[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(launches[0]?.id || null);
  useEffect(() => {
    setExpandedId(launches[0]?.id || null);
  }, [launches]);
  return (
    <div className={styles.launchList}>
      {launches.map((launch, i) => (
        <LaunchInfo
          key={launch.id}
          launch={launch}
          isNext={i === 0}
          isExpanded={expandedId === launch.id}
          onToggle={() => setExpandedId(expandedId === launch.id ? null : launch.id)}
        />
      ))}
    </div>
  );
}

function LaunchLocationInfo({ launches }: { launches: Launch[] }) {
  const locationName = launches[0]?.padLocation || launches[0]?.padName || 'Launch site';

  return (
    <div className={styles.infoPanelBody}>
      <div className={styles.siteLabel}>{locationName}</div>
      <LaunchCards launches={launches} />
    </div>
  );
}

function UpcomingLaunchesInfo({ launches }: { launches: Launch[] }) {
  return (
    <div className={styles.infoPanelBody}>
      <LaunchCards launches={launches} />
    </div>
  );
}

export default function InfoPanel({ satellite, launches, upcomingLaunches, onClose }: InfoPanelProps) {
  const hasLaunchSelection = !!(launches && launches.length > 0);
  const hasSatelliteSelection = !!satellite;
  const isOpen = hasSatelliteSelection || hasLaunchSelection || upcomingLaunches.length > 0;
  const title = satellite?.name
    || (hasLaunchSelection
      ? `${launches?.[0]?.padLocation || launches?.[0]?.padName || 'Launch site'}`
      : `Upcoming · ${upcomingLaunches.length}`);

  return (
    <div className={`${styles.infoPanel} ${isOpen ? styles.infoPanelOpen : ''}`}>
      <div className={styles.infoPanelHeader}>
        <h2 className={styles.infoPanelTitle}>{title}</h2>
        {(hasSatelliteSelection || hasLaunchSelection) && (
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        )}
      </div>
      {satellite && <SatelliteInfo sat={satellite} />}
      {!satellite && hasLaunchSelection && launches && <LaunchLocationInfo launches={launches} />}
      {!satellite && !hasLaunchSelection && upcomingLaunches.length > 0 && (
        <UpcomingLaunchesInfo launches={upcomingLaunches} />
      )}
    </div>
  );
}
