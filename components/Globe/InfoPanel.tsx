import { useState, useEffect } from 'react';
import styles from '../../styles/Globe.module.css';
import { SatellitePosition } from '../../lib/satellites';
import { Launch, formatLaunchDate, getLaunchStatusColor, getCountdown } from '../../lib/launches';

interface InfoPanelProps {
  satellite: SatellitePosition | null;
  launches: Launch[] | null;
  upcomingLaunches: Launch[];
  showUpcomingPanel?: boolean;
  onClose: () => void;
  onExpandUpcoming?: () => void;
}


function locationOnly(s: string): string {
  if (!s) return s;
  const parts = s.split(' · ').map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return s;
  const rockets = /^(Falcon 9|Falcon Heavy|Starship|Atlas V|Delta IV|Soyuz|Ariane|Long March|Electron|Firefly|Vulcan|New Glenn|SLS|Space Shuttle)$/i;
  const loc = parts.find((p) => !rockets.test(p));
  return loc || parts[parts.length - 1];
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
  if (cd.past) return <span className={styles.countdownText}>LIFTOFF</span>;
  return (
    <div className={styles.countdownUnits}>
      {cd.days > 0 && (
        <>
          <span className={styles.countdownNum}>{cd.days}</span>
          <span className={styles.countdownLabel}>D</span>
        </>
      )}
      <span className={styles.countdownNum}>{String(cd.hours).padStart(2, '0')}</span>
      <span className={styles.countdownLabel}>H</span>
      <span className={styles.countdownNum}>{String(cd.mins).padStart(2, '0')}</span>
      <span className={styles.countdownLabel}>M</span>
      <span className={styles.countdownNum}>{String(cd.secs).padStart(2, '0')}</span>
      <span className={styles.countdownLabel}>S</span>
    </div>
  );
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
    <div
      className={styles.launchCard}
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => e.key === 'Enter' && onToggle()}
    >
      <div className={styles.launchCardHeader}>
        <span className={styles.launchName}>{launch.name}</span>
      </div>
      {isNext ? (
        <div className={styles.countdownBlock}>
          <CountdownDisplay net={launch.net} />
        </div>
      ) : (
        <div className={styles.launchDate}>{formatLaunchDate(launch.net)}</div>
      )}
      {launch.padLocation && (
        <div className={styles.launchMeta}>{locationOnly(launch.padLocation)}</div>
      )}
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
                {launch.missionDescription.split(/[.!?]/)[0]?.trim() || launch.missionDescription.slice(0, 120)}
              </span>
            </div>
          )}
        </div>
      )}
      {isExpanded && launch.vidUrls && launch.vidUrls.length > 0 && (
        <div className={styles.videoLinks} onClick={(e) => e.stopPropagation()}>
          {launch.vidUrls
            .filter((v) => !/go for launch/i.test(v.title || ''))
            .slice(0, 2)
            .map((v, i) => {
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
        <div className={styles.videoLinks} onClick={(e) => e.stopPropagation()}>
          {launch.externalLinks
            .filter((link) => !/spacex\.com|x\.com\/spacex/i.test(link.url))
            .slice(0, 2)
            .map((link, i) => (
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
  const locationName = locationOnly(launches[0]?.padLocation || launches[0]?.padName || 'Launch site');

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

export default function InfoPanel({ satellite, launches, upcomingLaunches, showUpcomingPanel = true, onClose, onExpandUpcoming }: InfoPanelProps) {
  const hasLaunchSelection = !!(launches && launches.length > 0);
  const hasSatelliteSelection = !!satellite;
  const isOpen = hasSatelliteSelection || hasLaunchSelection || upcomingLaunches.length > 0;
  const title = satellite?.name
    || (hasLaunchSelection
      ? `${launches?.[0]?.padLocation || launches?.[0]?.padName || 'Launch site'}`
      : `Upcoming ${upcomingLaunches.length}`);

  const isUpcomingOnly = !hasSatelliteSelection && !hasLaunchSelection && upcomingLaunches.length > 0;
  const isCollapsed = isUpcomingOnly && !showUpcomingPanel;

  return (
    <div className={`${styles.infoPanel} ${isOpen ? styles.infoPanelOpen : ''} ${isCollapsed ? styles.infoPanelCollapsed : ''}`}>
      <div className={styles.infoPanelHeader}>
        <div className={styles.infoPanelTitleWrap}>
          <h2 className={styles.infoPanelTitle}>{isUpcomingOnly ? 'Upcoming' : title}</h2>
          {isUpcomingOnly && upcomingLaunches.length > 0 && (
            <span className={styles.upcomingBadge}>{upcomingLaunches.length}</span>
          )}
        </div>
        {isCollapsed ? (
          <button className={styles.expandBtn} onClick={onExpandUpcoming} aria-label="Expand">
            +
          </button>
        ) : isOpen ? (
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            −
          </button>
        ) : null}
      </div>
      {!isCollapsed && satellite && <SatelliteInfo sat={satellite} />}
      {!isCollapsed && !satellite && hasLaunchSelection && launches && <LaunchLocationInfo launches={launches} />}
      {!isCollapsed && !satellite && !hasLaunchSelection && upcomingLaunches.length > 0 && (
        <UpcomingLaunchesInfo launches={upcomingLaunches} />
      )}
    </div>
  );
}
