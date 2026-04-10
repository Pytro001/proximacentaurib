export interface LaunchVidUrl {
  url: string;
  title?: string;
  source?: string;
  isLive?: boolean;
}

export interface LaunchExternalLink {
  url: string;
  title: string;
}

export interface Launch {
  id: string;
  name: string;
  status: string;
  net: string;
  windowStart: string;
  windowEnd: string;
  provider: string;
  rocket: string;
  mission: string;
  missionDescription: string;
  orbitName: string;
  padName: string;
  padLocation: string;
  providerUrl?: string;
  lat: number | null;
  lng: number | null;
  image: string | null;
  vidUrls: LaunchVidUrl[];
  externalLinks: LaunchExternalLink[];
}

function getApiBase(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : 'http://localhost:3000';
}

export async function fetchLaunches(): Promise<Launch[]> {
  try {
    const res = await fetch(`${getApiBase()}/api/launches`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch launches:', err);
    return [];
  }
}

export type SatelliteCatalogMode = 'lite' | 'full';

export async function fetchSatelliteData(
  catalog: SatelliteCatalogMode = 'lite'
): Promise<any[]> {
  const group = catalog === 'full' ? 'all' : 'lite';
  try {
    const res = await fetch(`${getApiBase()}/api/satellites?group=${group}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch satellite data:', err);
    return [];
  }
}

export function formatLaunchDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return dateStr;
  }
}

export function getLaunchStatusColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('success')) return '#00c853';
  if (s.includes('go') || s.includes('tbd') || s.includes('tbc')) return '#1d9bf0';
  if (s.includes('in flight')) return '#ff6d00';
  if (s.includes('fail')) return '#ff1744';
  return '#8899a6';
}

export function filterLaunchesByDestination(
  launches: Launch[],
  destination: 'earth' | 'moon' | 'mars'
): Launch[] {
  if (destination === 'earth') return launches;
  const text = (l: Launch) =>
    [l.name, l.mission, l.missionDescription, l.orbitName].join(' ').toLowerCase();
  if (destination === 'moon') {
    return launches.filter((l) => {
      const t = text(l);
      return /\b(moon|lunar|selene|artemis|clps|griffin|viper|capstone)\b/i.test(t);
    });
  }
  if (destination === 'mars') {
    return launches.filter((l) => {
      const t = text(l);
      return /\b(mars|martian|red planet|exomars|tianwen|hope|maven|odyssey)\b/i.test(t);
    });
  }
  return launches;
}

/** Case-insensitive match against common launch fields (for sidebar search). */
export function launchMatchesSearchQuery(launch: Launch, query: string): boolean {
  const s = query.trim().toLowerCase();
  if (!s) return true;
  const hay = [
    launch.name,
    launch.rocket,
    launch.provider,
    launch.padLocation,
    launch.padName,
    launch.orbitName,
    launch.mission,
    launch.missionDescription,
  ]
    .join(' ')
    .toLowerCase();
  return hay.includes(s);
}

export function getCountdown(net: string): { days: number; hours: number; mins: number; secs: number; past: boolean } {
  const target = Date.parse(net);
  const now = Date.now();
  const diff = target - now;
  if (diff <= 0) {
    return { days: 0, hours: 0, mins: 0, secs: 0, past: true };
  }
  const secs = Math.floor((diff / 1000) % 60);
  const mins = Math.floor((diff / 60000) % 60);
  const hours = Math.floor((diff / 3600000) % 24);
  const days = Math.floor(diff / 86400000);
  return { days, hours, mins, secs, past: false };
}
