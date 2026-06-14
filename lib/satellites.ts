import * as satellite from 'satellite.js';
import { getSatelliteDescription } from './satelliteDescriptions';

export interface SatellitePosition {
  id: string;
  name: string;
  lat: number;
  lng: number;
  alt: number; // km
  velocity: number; // km/s
  category: string;
  noradId: number;
  inclination: number;
  period: number; // minutes
  eccentricity: number;
  orbitType: string;
  useCase: string;
}

export interface SatelliteOrbitPath {
  id: string;
  name: string;
  category: string;
  coords: Array<{ lat: number; lng: number; alt: number }>;
}

interface ParsedSatellite {
  name: string;
  noradId: number;
  satrec: satellite.SatRec;
  category: string;
  inclination: number;
  eccentricity: number;
  period: number;
}

function classifyOrbit(altKm: number): string {
  if (altKm < 2000) return 'LEO';
  if (altKm < 35786 - 1000) return 'MEO';
  if (altKm >= 35786 - 1000 && altKm <= 35786 + 1000) return 'GEO';
  return 'HEO';
}

function categorizeByName(name: string): string {
  const n = name.toUpperCase();

  if (n.includes('DEB') || n.includes('R/B') || /\bROCKET BODY\b/.test(n)) return 'Debris';

  if (/^ISS \(ZARYA\)$|^ISS \(NAUKA\)$|^POISK$/.test(n)) return 'Station';
  if (/^CSS \(|^TIANHE|^TIANGONG|^WENTIAN|^MENGTIAN/.test(n)) return 'Station';

  if (/^USA\s*[-\s]?\d|^NROL|^KH-|LACROSSE|ONYX|SBIRS|DSP\s|MILSTAR|AEHF|WGS[-\s]|MUOS|DMSP|NOSS|TRUMPET|MERCURY|MENTOR|ORION\s*\d|INTRUDER|MISTY|^GSSAP|^OTV|^X-37/.test(n)) return 'Military';
  if (/^KOSMOS|^COSMOS|^LUCH\b|^TSELINA|^PION|^LOTOS/.test(n)) return 'Military';
  if (/YAOGAN|GAOFEN|JILIN|LUDAN|TIANHUI|ZHIJI|SHIYAN|CHUANGXIN|TONGXIN|SHIJIAN/.test(n)) return 'Military';
  if (/^SAR-LUPE|^HELIOS|^OFEK|^EROS\b|^CSO-|^PLEIADES NEO/.test(n)) return 'Military';

  if (n.includes('STARLINK') || n.includes('ONEWEB') || n.includes('KUIPER')) return 'Constellation';
  if (n.includes('GPS') || n.includes('NAVSTAR') || n.includes('GALILEO')) return 'Navigation';
  if (n.includes('GLONASS') || n.includes('BEIDOU') || n.includes('COMPASS') || n.includes('QZSS') || n.includes('IRNSS') || n.includes('NAVIC')) return 'Navigation';

  if (n.includes('GOES') || n.includes('NOAA') || n.includes('METEOSAT') || n.includes('METOP') || n.includes('HIMAWARI') || n.includes('FY-') || n.includes('FENGYUN') || n.includes('INSAT') || n.includes('ELEKTRO')) return 'Weather';

  if (n.includes('HUBBLE') || n.includes('JAMES WEBB') || n.includes('CHANDRA') || n.includes('SPITZER') || n.includes('XMM') || n.includes('FERMI') || n.includes('SWIFT') || n.includes('NUSTAR') || n.includes('IXPE') || n.includes('WISE') || n.includes('TESS')) return 'Science';

  if (n.includes('IRIDIUM') || n.includes('ORBCOMM') || n.includes('GLOBALSTAR')) return 'Communications';
  if (n.includes('INTELSAT') || n.includes('SES') || n.includes('TELESAT') || n.includes('EUTELSAT') || n.includes('AMOS') || n.includes('ASTRA') || n.includes('DIRECTV') || n.includes('ECHOSTAR') || n.includes('VIASAT') || n.includes('THURAYA') || n.includes('O3B') || n.includes('ARABSAT') || n.includes('TURKSAT') || n.includes('HISPASAT') || n.includes('CHINASAT') || n.includes('APSTAR') || n.includes('ASIASAT') || n.includes('JCSAT')) return 'Communications';

  if (n.includes('LANDSAT') || n.includes('SENTINEL') || n.includes('SPOT') || n.includes('WORLDVIEW') || n.includes('PLEIADES')) return 'Earth Observation';
  if (n.includes('TERRA') || n.includes('AQUA') || n.includes('SUOMI') || n.includes('JPSS') || n.includes('ENVISAT') || n.includes('CRYOSAT') || n.includes('AEOLUS') || n.includes('SWARM') || n.includes('GRACE') || n.includes('ICE')) return 'Earth Observation';

  if (n.includes('PROGRESS') || n.includes('SOYUZ') || n.includes('CYGNUS') || n.includes('DRAGON') || n.includes('TIANZHOU') || n.includes('HTV')) return 'Cargo';
  if (n.includes('SHENZHOU') || n.includes('CREW DRAGON') || n.includes('STARLINER')) return 'Crew';

  if (n.includes('PLANET') || n.includes('FLOCK') || n.includes('SPIRE') || n.includes('LEMUR') || n.includes('HAWKEYE') || n.includes('ICEYE') || n.includes('CAPELLA') || n.includes('ASTROCAST') || n.includes('KLEOS') || n.includes('GHGSAT') || n.includes('BLACKSKY') || n.includes('UMBRA') || n.includes('SATELLOGIC') || n.includes('SWARM') || n.includes('LYNK') || n.includes('LACUNA') || n.includes('MYRIOTA') || n.includes('KEPLER')) return 'Private';

  return 'Other';
}

let parsedSatellites: ParsedSatellite[] = [];

export interface ParseSatelliteOptions {
  /** When true (default), skip debris and rocket-body clutter to reduce load. */
  excludeDebris?: boolean;
}

export function clearSatelliteCatalog(): void {
  parsedSatellites = [];
}

/** Count objects that would be kept by parseSatelliteData without mutating the catalog. */
export function countCatalogRecords(
  records: satellite.OMMJsonObject[],
  options?: ParseSatelliteOptions
): number {
  if (!records.length) return 0;
  const excludeDebris = options?.excludeDebris !== false;
  let count = 0;
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    if (!rec.OBJECT_NAME || !rec.EPOCH) continue;
    try {
      satellite.json2satrec(rec);
      const category = categorizeByName(rec.OBJECT_NAME);
      if (excludeDebris && category === 'Debris') continue;
      count++;
    } catch {
      // skip invalid records
    }
  }
  return count;
}

export function parseSatelliteData(
  records: satellite.OMMJsonObject[],
  options?: ParseSatelliteOptions
): void {
  parsedSatellites = [];
  const excludeDebris = options?.excludeDebris !== false;

  const limit = records.length;

  for (let i = 0; i < limit; i++) {
    const rec = records[i];
    if (!rec.OBJECT_NAME || !rec.EPOCH) continue;

    try {
      const satrec = satellite.json2satrec(rec);
      const meanMotion = typeof rec.MEAN_MOTION === 'string'
        ? parseFloat(rec.MEAN_MOTION)
        : rec.MEAN_MOTION;
      const period = meanMotion > 0 ? 1440 / meanMotion : 0;
      const eccentricity = typeof rec.ECCENTRICITY === 'string'
        ? parseFloat(rec.ECCENTRICITY)
        : rec.ECCENTRICITY;
      const inclination = typeof rec.INCLINATION === 'string'
        ? parseFloat(rec.INCLINATION)
        : rec.INCLINATION;
      const noradId = typeof rec.NORAD_CAT_ID === 'string'
        ? parseInt(rec.NORAD_CAT_ID, 10)
        : rec.NORAD_CAT_ID;

      const category = categorizeByName(rec.OBJECT_NAME);
      if (excludeDebris && category === 'Debris') continue;

      parsedSatellites.push({
        name: rec.OBJECT_NAME,
        noradId,
        satrec,
        category,
        inclination,
        eccentricity,
        period,
      });
    } catch {
      // skip invalid records
    }
  }
}

export function propagatePositions(date: Date): SatellitePosition[] {
  const positions: SatellitePosition[] = [];
  const gmst = satellite.gstime(date);

  for (const sat of parsedSatellites) {
    try {
      const posVel = satellite.propagate(sat.satrec, date);
      if (!posVel) continue;

      const posEci = posVel.position;
      const velEci = posVel.velocity;

      const geo = satellite.eciToGeodetic(posEci, gmst);
      const lat = satellite.degreesLat(geo.latitude);
      const lng = satellite.degreesLong(geo.longitude);
      const alt = geo.height;

      if (isNaN(lat) || isNaN(lng) || isNaN(alt) || alt < 0 || alt > 100000) continue;

      const velocity = Math.sqrt(velEci.x ** 2 + velEci.y ** 2 + velEci.z ** 2);

      positions.push({
        id: `sat-${sat.noradId}`,
        name: sat.name,
        lat,
        lng,
        alt,
        velocity,
        category: sat.category,
        noradId: sat.noradId,
        inclination: sat.inclination,
        period: sat.period,
        eccentricity: sat.eccentricity,
        orbitType: classifyOrbit(alt),
        useCase: getSatelliteDescription(sat.name, sat.category),
      });
    } catch {
      // skip propagation failures
    }
  }

  return positions;
}

const EARTH_RADIUS_KM = 6371.0088;

export function computeOrbitPath(
  noradId: number,
  durationMinutes: number = 90,
  steps: number = 180
): SatelliteOrbitPath | null {
  const sat = parsedSatellites.find((s) => s.noradId === noradId);
  if (!sat) return null;

  const coords: Array<{ lat: number; lng: number; alt: number }> = [];
  const now = Date.now();
  const stepMs = (durationMinutes * 60 * 1000) / steps;

  for (let i = 0; i <= steps; i++) {
    const date = new Date(now + i * stepMs);
    try {
      const gmst = satellite.gstime(date);
      const posVel = satellite.propagate(sat.satrec, date);
      if (!posVel) continue;

      const posEci = posVel.position;
      const geo = satellite.eciToGeodetic(posEci, gmst);
      const lat = satellite.degreesLat(geo.latitude);
      const lng = satellite.degreesLong(geo.longitude);
      const alt = geo.height;

      if (!isNaN(lat) && !isNaN(lng) && !isNaN(alt) && alt >= 0) {
        coords.push({ lat, lng, alt: alt / EARTH_RADIUS_KM });
      }
    } catch {
      // skip
    }
  }

  if (coords.length < 2) return null;

  return {
    id: `path-${noradId}`,
    name: sat.name,
    category: sat.category,
    coords,
  };
}

export function getSatelliteCount(): number {
  return parsedSatellites.length;
}

const DEG = Math.PI / 180;

function geodeticToEcef(latDeg: number, lngDeg: number, altKm: number): [number, number, number] {
  // Spherical approximation — precise enough for line-of-sight / look-angle visuals.
  const r = EARTH_RADIUS_KM + altKm;
  const lat = latDeg * DEG;
  const lng = lngDeg * DEG;
  const cl = Math.cos(lat);
  return [r * cl * Math.cos(lng), r * cl * Math.sin(lng), r * Math.sin(lat)];
}

export interface OverheadSat {
  id: string;
  name: string;
  category: string;
  noradId: number;
  /** Degrees above the local horizon (90 = straight up). */
  elevation: number;
  /** Compass bearing from observer, degrees clockwise from north. */
  azimuth: number;
  /** Straight-line distance observer → satellite, km. */
  range: number;
  alt: number;
}

/** Compass label (N, NE, …) for an azimuth in degrees. */
export function azimuthToCompass(azimuth: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(((azimuth % 360) / 45)) % 8];
}

/**
 * Given an observer (lat/lng on the surface) and a set of already-propagated
 * satellite positions, return those currently above the local horizon, sorted
 * by elevation (highest in the sky first). Pure geometry over the supplied
 * positions, so it's cheap enough to re-run on every animation tick.
 */
export function computeOverhead(
  observerLat: number,
  observerLng: number,
  positions: SatellitePosition[],
  minElevationDeg = 0,
  limit = 60
): OverheadSat[] {
  const obs = geodeticToEcef(observerLat, observerLng, 0);
  const obsLen = Math.hypot(obs[0], obs[1], obs[2]) || 1;
  const latR = observerLat * DEG;
  const lngR = observerLng * DEG;
  const east: [number, number, number] = [-Math.sin(lngR), Math.cos(lngR), 0];
  const north: [number, number, number] = [
    -Math.sin(latR) * Math.cos(lngR),
    -Math.sin(latR) * Math.sin(lngR),
    Math.cos(latR),
  ];

  const results: OverheadSat[] = [];
  for (const s of positions) {
    const sat = geodeticToEcef(s.lat, s.lng, s.alt);
    const los: [number, number, number] = [sat[0] - obs[0], sat[1] - obs[1], sat[2] - obs[2]];
    const losLen = Math.hypot(los[0], los[1], los[2]);
    if (losLen === 0) continue;
    // Local "up" at the observer is just the observer position direction.
    const dotUp = (los[0] * obs[0] + los[1] * obs[1] + los[2] * obs[2]) / (losLen * obsLen);
    const elevation = Math.asin(Math.max(-1, Math.min(1, dotUp))) / DEG;
    if (elevation < minElevationDeg) continue;
    const e = los[0] * east[0] + los[1] * east[1] + los[2] * east[2];
    const n = los[0] * north[0] + los[1] * north[1] + los[2] * north[2];
    let az = Math.atan2(e, n) / DEG;
    if (az < 0) az += 360;
    results.push({
      id: s.id,
      name: s.name,
      category: s.category,
      noradId: s.noradId,
      elevation,
      azimuth: az,
      range: losLen,
      alt: s.alt,
    });
  }
  results.sort((a, b) => b.elevation - a.elevation);
  return results.slice(0, limit);
}

export interface SatelliteSearchResult {
  name: string;
  noradId: number;
  category: string;
}

export function searchSatellites(query: string, limit = 30): SatelliteSearchResult[] {
  if (!query || query.trim().length < 2) return [];
  const q = query.trim().toLowerCase();
  return parsedSatellites
    .filter((s) => s.name.toLowerCase().includes(q))
    .map((s) => ({ name: s.name, noradId: s.noradId, category: s.category }))
    .slice(0, limit);
}
