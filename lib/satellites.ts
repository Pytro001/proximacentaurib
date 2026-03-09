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
  if (n.includes('STARLINK') || n.includes('ONEWEB') || n.includes('KUIPER')) return 'Starlink';
  if (n.includes('GPS') || n.includes('NAVSTAR')) return 'Navigation';
  if (n.includes('GALILEO')) return 'Navigation';
  if (n.includes('GLONASS') || n.includes('GLONASS-M') || n.includes('GLONASS-K')) return 'Navigation';
  if (n.includes('BEIDOU') || n.includes('COMPASS')) return 'Navigation';
  if (n.includes('QZSS')) return 'Navigation';
  if (n.includes('GOES') || n.includes('NOAA') || n.includes('METEOSAT') || n.includes('METOP') || n.includes('HIMAWARI')) return 'Weather';
  if (/^ISS \(ZARYA\)$|^ISS \(NAUKA\)$|^POISK$/.test(n)) return 'Station';
  if (/^CSS \(|^TIANHE|^TIANGONG|^WENTIAN|^MENGTIAN/.test(n)) return 'Station';
  if (n.includes('HUBBLE') || n.includes('JAMES WEBB') || n.includes('CHANDRA') || n.includes('SPITZER') || n.includes('XMM')) return 'Science';
  if (n.includes('IRIDIUM') || n.includes('ORBCOMM') || n.includes('GLOBALSTAR')) return 'Communications';
  if (n.includes('INTELSAT') || n.includes('SES') || n.includes('TELESAT') || n.includes('EUTELSAT') || n.includes('AMOS')) return 'Communications';
  if (n.includes('LANDSAT') || n.includes('SENTINEL') || n.includes('SPOT') || n.includes('WORLDVIEW') || n.includes('PLANET')) return 'Earth Observation';
  if (n.includes('TERRA') || n.includes('AQUA') || n.includes('SUOMI') || n.includes('JPSS')) return 'Earth Observation';
  if (n.includes('PROGRESS') || n.includes('SOYUZ') || n.includes('CYGNUS') || n.includes('DRAGON') || n.includes('TIANZHOU') || n.includes('HTV')) return 'Cargo';
  if (n.includes('SHENZHOU') || n.includes('CREW DRAGON')) return 'Crew';
  if (n.includes('STARLINK') && n.includes('DEB')) return 'Debris';
  if (n.includes('DEB') || n.includes('R/B') || n.includes('Rocket')) return 'Debris';
  return 'Other';
}

let parsedSatellites: ParsedSatellite[] = [];

export function parseSatelliteData(records: satellite.OMMJsonObject[]): void {
  parsedSatellites = [];

  const limit = Math.min(records.length, 2000);

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

      parsedSatellites.push({
        name: rec.OBJECT_NAME,
        noradId,
        satrec,
        category: categorizeByName(rec.OBJECT_NAME),
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
