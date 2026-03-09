import * as satellite from 'satellite.js';

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
  if (n.includes('STARLINK')) return 'Starlink';
  if (n.includes('GPS') || n.includes('NAVSTAR')) return 'Navigation';
  if (n.includes('GALILEO')) return 'Navigation';
  if (n.includes('GLONASS')) return 'Navigation';
  if (n.includes('BEIDOU')) return 'Navigation';
  if (n.includes('GOES') || n.includes('NOAA') || n.includes('METEOSAT') || n.includes('METOP')) return 'Weather';
  if (n.includes('ISS') || n.includes('ZARYA') || n.includes('TIANGONG') || n.includes('CSS')) return 'Station';
  if (n.includes('HUBBLE') || n.includes('JAMES WEBB') || n.includes('CHANDRA')) return 'Science';
  if (n.includes('IRIDIUM')) return 'Communications';
  if (n.includes('INTELSAT') || n.includes('SES') || n.includes('TELESAT')) return 'Communications';
  return 'Other';
}

function getSatelliteUseCase(name: string, category: string): string {
  const n = name.toUpperCase();
  if (category === 'Station') return 'Crewed space station for research and habitation in low Earth orbit.';
  if (category === 'Starlink') return 'Broadband internet constellation providing global satellite internet coverage.';
  if (category === 'Navigation') return 'Satellite navigation system for GPS positioning, timing, and navigation worldwide.';
  if (category === 'Weather') return 'Weather monitoring and forecasting; observes Earth atmosphere, clouds, and climate.';
  if (category === 'Science') return 'Space telescope or scientific observatory for astronomy and astrophysics research.';
  if (category === 'Communications') return 'Communications satellite for TV, radio, telephone, and data relay services.';
  if (n.includes('IRIDIUM')) return 'Mobile voice and data satellite communications network.';
  if (n.includes('GOES')) return 'Geostationary weather satellite monitoring Americas.';
  if (n.includes('NOAA')) return 'Polar-orbiting weather and environmental monitoring.';
  if (n.includes('METEOSAT')) return 'European geostationary weather satellite.';
  if (n.includes('LANDSAT') || n.includes('SENTINEL')) return 'Earth observation for land use, agriculture, and environmental monitoring.';
  if (n.includes('TERRA') || n.includes('AQUA')) return 'NASA Earth observation for climate and environmental science.';
  if (n.includes('HUBBLE')) return 'Optical space telescope for deep-space astronomy.';
  if (n.includes('JAMES WEBB') || n.includes('JWST')) return 'Infrared space telescope for early universe and exoplanet research.';
  if (n.includes('CHANDRA')) return 'X-ray observatory for high-energy astrophysics.';
  if (category === 'Other') return 'General-purpose or specialized satellite.';
  return `${category} satellite.`;
}

let parsedSatellites: ParsedSatellite[] = [];

export function parseSatelliteData(records: satellite.OMMJsonObject[]): void {
  parsedSatellites = [];

  const limit = Math.min(records.length, 500);

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
        useCase: getSatelliteUseCase(sat.name, sat.category),
      });
    } catch {
      // skip propagation failures
    }
  }

  return positions;
}

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

      if (!isNaN(lat) && !isNaN(lng) && !isNaN(alt)) {
        coords.push({ lat, lng, alt: alt / 6371 }); // normalized to Earth radii for globe.gl
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
