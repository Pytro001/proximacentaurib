import { useState, useEffect, type MouseEvent } from 'react';
import styles from '../../styles/Globe.module.css';
import { SatellitePosition } from '../../lib/satellites';
import { OrbiterPosition } from '../../lib/orbiters';
import { Launch, formatLaunchDate, getLaunchStatusColor, getCountdown } from '../../lib/launches';
import {
  youtubeVideoId,
  youtubeThumbnailUrl,
  videoPreviewKind,
} from '../../lib/launchMedia';

interface InfoPanelProps {
  satellite: SatellitePosition | null;
  orbiter: OrbiterPosition | null;
  launches: Launch[] | null;
  upcomingLaunches: Launch[];
  showUpcomingPanel?: boolean;
  globeId?: string;
  onClose: () => void;
  onExpandUpcoming?: () => void;
  onShowLaunchOnGlobe?: (launch: Launch) => void;
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

function OrbiterInfo({ orb }: { orb: OrbiterPosition }) {
  const bodyLabel = orb.body === 'moon' ? 'Moon' : 'Mars';
  const periodHrs = orb.periodMinutes >= 60 ? (orb.periodMinutes / 60).toFixed(1) : orb.periodMinutes.toFixed(1);
  const periodUnit = orb.periodMinutes >= 60 ? 'hr' : 'min';

  return (
    <div className={styles.infoPanelBody}>
      <div className={styles.categoryTag}>{orb.category}</div>

      <div className={styles.dataField}>
        <span className={styles.dataLabel}>Orbiting</span>
        <span className={styles.dataValue}>{bodyLabel}</span>
      </div>

      <div className={styles.divider} />

      <div className={styles.dataField}>
        <span className={styles.dataLabel}>Altitude</span>
        <span className={styles.dataValueMono}>
          {orb.alt.toFixed(1)} km
        </span>
      </div>

      <div className={styles.dataField}>
        <span className={styles.dataLabel}>Inclination</span>
        <span className={styles.dataValueMono}>
          {orb.inclinationDeg.toFixed(2)}°
        </span>
      </div>

      <div className={styles.dataField}>
        <span className={styles.dataLabel}>Period</span>
        <span className={styles.dataValueMono}>
          {periodHrs} {periodUnit}
        </span>
      </div>

      <div className={styles.divider} />

      <div className={styles.dataField}>
        <span className={styles.dataLabel}>Position</span>
        <span className={styles.dataValueMono}>
          {orb.lat.toFixed(4)}° N, {orb.lng.toFixed(4)}° E
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
  onShowLaunchOnGlobe,
}: {
  launch: Launch;
  isNext?: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onShowLaunchOnGlobe?: (launch: Launch) => void;
}) {
  const statusColor = getLaunchStatusColor(launch.status);
  const [inlineYoutubeId, setInlineYoutubeId] = useState<string | null>(null);

  useEffect(() => {
    if (!isExpanded) setInlineYoutubeId(null);
  }, [isExpanded]);

  const vids = (launch.vidUrls || []).filter((v) => !/go for launch/i.test(v.title || ''));
  const ytPreviews = vids
    .map((v) => ({ v, id: youtubeVideoId(v.url) }))
    .filter((x): x is { v: (typeof vids)[0]; id: string } => !!x.id)
    .slice(0, 3);
  const xUrlSeen = new Set<string>();
  const xPreviews: { url: string; title?: string; isLive?: boolean }[] = [];
  for (const v of vids) {
    if (videoPreviewKind(v.url) !== 'x' || xUrlSeen.has(v.url)) continue;
    xUrlSeen.add(v.url);
    xPreviews.push({ url: v.url, title: v.title, isLive: v.isLive });
  }
  for (const link of launch.externalLinks || []) {
    if (videoPreviewKind(link.url) !== 'x' || xUrlSeen.has(link.url)) continue;
    xUrlSeen.add(link.url);
    xPreviews.push({ url: link.url, title: link.title });
  }
  const xPreviewsShown = xPreviews.slice(0, 2);

  const openYtInline = (id: string, e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setInlineYoutubeId((cur) => (cur === id ? null : id));
    if (!isExpanded) onToggle();
  };

  return (
    <div className={styles.launchCard}>
      <div
        className={styles.launchCardMain}
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => e.key === 'Enter' && onToggle()}
      >
        {(launch.image || ytPreviews.length > 0 || xPreviewsShown.length > 0) && (
          <div className={styles.launchMediaStrip}>
            {launch.image && (
              <div className={styles.launchMediaHero}>
                <img src={launch.image} alt="" className={styles.launchHeroImg} loading="lazy" />
              </div>
            )}
            {ytPreviews.map(({ v, id }) => (
              <button
                key={v.url}
                type="button"
                className={styles.launchYtThumb}
                onClick={(e) => openYtInline(id, e)}
                title={v.title || 'YouTube'}
              >
                <img src={youtubeThumbnailUrl(id)} alt="" loading="lazy" />
                <span className={styles.launchYtPlay}>▶</span>
              </button>
            ))}
            {xPreviewsShown.map((v) => (
              <a
                key={v.url}
                href={v.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.launchXThumb}
                onClick={(e) => e.stopPropagation()}
              >
                <span className={styles.launchXMark}>𝕏</span>
                <span className={styles.launchXLabel}>
                  {v.isLive ? 'Live on X' : v.title?.slice(0, 40) || 'Open on X'}
                </span>
              </a>
            ))}
          </div>
        )}

        <div className={styles.launchCardHeader}>
          {isNext && <span className={styles.nextBadge}>NEXT</span>}
          <span className={styles.launchName}>{launch.name}</span>
          <span className={styles.expandIcon} aria-hidden>{isExpanded ? '▼' : '▶'}</span>
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
        <div className={styles.launchQuickFacts}>
          <span>{launch.rocket}</span>
          <span className={styles.launchQuickDot}>·</span>
          <span>{launch.provider}</span>
        </div>
      </div>

      {launch.lat != null && launch.lng != null && onShowLaunchOnGlobe && (
        <button
          type="button"
          className={styles.launchGlobeBtn}
          onClick={(e) => {
            e.stopPropagation();
            onShowLaunchOnGlobe(launch);
          }}
        >
          Globe
        </button>
      )}

      {inlineYoutubeId && (
        <div className={styles.launchEmbedWrap} onClick={(e) => e.stopPropagation()}>
          <iframe
            title="Webcast"
            src={`https://www.youtube.com/embed/${inlineYoutubeId}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className={styles.launchEmbedIframe}
          />
        </div>
      )}

      {isExpanded && (
        <div className={styles.launchDetails}>
          <div className={styles.dataField}>
            <span className={styles.dataLabel}>Status</span>
            <span className={styles.dataValue} style={{ color: statusColor }}>{launch.status}</span>
          </div>
          {!!launch.orbitName && (
            <div className={styles.dataField}>
              <span className={styles.dataLabel}>Target orbit</span>
              <span className={styles.dataValue}>{launch.orbitName}</span>
            </div>
          )}
          {!!launch.missionDescription && (
            <div className={styles.dataField}>
              <span className={styles.dataLabel}>Mission</span>
              <span className={styles.dataValue}>
                {launch.missionDescription.split(/[.!?]/)[0]?.trim() || launch.missionDescription.slice(0, 160)}
              </span>
            </div>
          )}
        </div>
      )}
      {isExpanded && launch.vidUrls && launch.vidUrls.length > 0 && (
        <div className={styles.videoLinks} onClick={(e) => e.stopPropagation()}>
          {launch.vidUrls
            .filter((v) => !/go for launch/i.test(v.title || ''))
            .slice(0, 4)
            .map((v, i) => {
            const kind = videoPreviewKind(v.url);
            const isYt = kind === 'youtube';
            const label =
              v.title || (v.isLive ? 'Livestream' : (isYt ? 'YouTube' : kind === 'x' ? 'X' : 'Watch'));
            return (
              <a key={i} href={v.url} target="_blank" rel="noopener noreferrer" className={styles.videoLink}>
                <span>{isYt ? '▶' : kind === 'x' ? '𝕏' : '🔗'}</span> {label}
              </a>
            );
          })}
        </div>
      )}
      {isExpanded && launch.externalLinks && launch.externalLinks.length > 0 && (
        <div className={styles.videoLinks} onClick={(e) => e.stopPropagation()}>
          {launch.externalLinks
            .filter((link) => !/spacex\.com|x\.com\/spacex/i.test(link.url))
            .slice(0, 4)
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

function LaunchCards({
  launches,
  onShowLaunchOnGlobe,
}: {
  launches: Launch[];
  onShowLaunchOnGlobe?: (launch: Launch) => void;
}) {
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
          onShowLaunchOnGlobe={onShowLaunchOnGlobe}
        />
      ))}
    </div>
  );
}

function LaunchLocationInfo({
  launches,
  onShowLaunchOnGlobe,
}: {
  launches: Launch[];
  onShowLaunchOnGlobe?: (launch: Launch) => void;
}) {
  const locationName = locationOnly(launches[0]?.padLocation || launches[0]?.padName || 'Launch site');

  return (
    <div className={styles.infoPanelBody}>
      <div className={styles.siteLabel}>{locationName}</div>
      <LaunchCards launches={launches} onShowLaunchOnGlobe={onShowLaunchOnGlobe} />
    </div>
  );
}

function UpcomingLaunchesInfo({
  launches,
  onShowLaunchOnGlobe,
}: {
  launches: Launch[];
  onShowLaunchOnGlobe?: (launch: Launch) => void;
}) {
  return (
    <div className={styles.infoPanelBody}>
      <LaunchCards launches={launches} onShowLaunchOnGlobe={onShowLaunchOnGlobe} />
    </div>
  );
}

export default function InfoPanel({
  satellite,
  orbiter,
  launches,
  upcomingLaunches,
  showUpcomingPanel = true,
  globeId = 'earth',
  onClose,
  onExpandUpcoming,
  onShowLaunchOnGlobe,
}: InfoPanelProps) {
  const hasLaunchSelection = !!(launches && launches.length > 0);
  const hasSatelliteSelection = !!satellite;
  const hasOrbiterSelection = !!orbiter;
  const isUpcomingOnly = !hasSatelliteSelection && !hasOrbiterSelection && !hasLaunchSelection && showUpcomingPanel;
  const isOpen = hasSatelliteSelection || hasOrbiterSelection || hasLaunchSelection || (showUpcomingPanel && (upcomingLaunches.length > 0 || globeId !== 'earth'));
  const title = satellite?.name
    || orbiter?.name
    || (hasLaunchSelection
      ? `${launches?.[0]?.padLocation || launches?.[0]?.padName || 'Launch site'}`
      : `Upcoming ${upcomingLaunches.length}`);

  const bodyLabel = globeId === 'moon' ? 'Moon' : globeId === 'mars' ? 'Mars' : '';

  return (
    <div className={`${styles.infoPanel} ${isOpen ? styles.infoPanelOpen : ''}`}>
      <div className={styles.infoPanelHeader}>
        <div className={styles.infoPanelTitleWrap}>
          <h2 className={styles.infoPanelTitle}>{isUpcomingOnly ? 'Upcoming' : title}</h2>
          {isUpcomingOnly && upcomingLaunches.length > 0 && (
            <span className={styles.upcomingBadge}>{upcomingLaunches.length}</span>
          )}
        </div>
        {isOpen && !isUpcomingOnly && (
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            −
          </button>
        )}
      </div>
      {satellite && <SatelliteInfo sat={satellite} />}
      {!satellite && orbiter && <OrbiterInfo orb={orbiter} />}
      {!satellite && !orbiter && hasLaunchSelection && launches && (
        <LaunchLocationInfo launches={launches} onShowLaunchOnGlobe={onShowLaunchOnGlobe} />
      )}
      {!satellite && !orbiter && !hasLaunchSelection && upcomingLaunches.length > 0 && (
        <UpcomingLaunchesInfo launches={upcomingLaunches} onShowLaunchOnGlobe={onShowLaunchOnGlobe} />
      )}
      {isUpcomingOnly && upcomingLaunches.length === 0 && globeId !== 'earth' && (
        <div className={styles.infoPanelBody}>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>
            No upcoming {bodyLabel} missions scheduled
          </p>
        </div>
      )}
    </div>
  );
}
