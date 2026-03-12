/**
 * Simplified orbital propagation for Moon and Mars orbiters.
 * Uses circular orbit approximation with known orbital parameters.
 */

const MOON_RADIUS_KM = 1737.4;
const MARS_RADIUS_KM = 3389.5;

export interface OrbiterPosition {
  id: string;
  name: string;
  lat: number;
  lng: number;
  alt: number;
  category: string;
  periodMinutes: number;
  inclinationDeg: number;
  body: 'moon' | 'mars';
}

interface OrbiterDef {
  id: string;
  name: string;
  body: 'moon' | 'mars';
  radiusKm: number;
  periodMinutes: number;
  inclinationDeg: number;
  raanDeg: number;
  meanAnomaly0Deg: number;
  category: string;
}

const MOON_ORBITERS: OrbiterDef[] = [
  { id: 'lro', name: 'Lunar Reconnaissance Orbiter (NASA)', body: 'moon', radiusKm: MOON_RADIUS_KM + 50, periodMinutes: 113, inclinationDeg: 90, raanDeg: 0, meanAnomaly0Deg: 0, category: 'Earth Observation' },
  { id: 'capstone', name: 'CAPSTONE (NASA / Rocket Lab)', body: 'moon', radiusKm: MOON_RADIUS_KM + 3500, periodMinutes: 6.5 * 24 * 60, inclinationDeg: 90, raanDeg: 0, meanAnomaly0Deg: 45, category: 'Navigation' },
];

const MARS_ORBITERS: OrbiterDef[] = [
  { id: 'odyssey', name: '2001 Mars Odyssey (NASA)', body: 'mars', radiusKm: MARS_RADIUS_KM + 400, periodMinutes: 118, inclinationDeg: 93, raanDeg: 120, meanAnomaly0Deg: 270, category: 'Communications' },
  { id: 'mars-express', name: 'Mars Express (ESA)', body: 'mars', radiusKm: MARS_RADIUS_KM + 5400, periodMinutes: 420, inclinationDeg: 86, raanDeg: 200, meanAnomaly0Deg: 30, category: 'Science' },
  { id: 'mro', name: 'Mars Reconnaissance Orbiter (NASA)', body: 'mars', radiusKm: MARS_RADIUS_KM + 300, periodMinutes: 112, inclinationDeg: 93, raanDeg: 0, meanAnomaly0Deg: 0, category: 'Earth Observation' },
  { id: 'maven', name: 'MAVEN (NASA)', body: 'mars', radiusKm: MARS_RADIUS_KM + 4000, periodMinutes: 270, inclinationDeg: 75, raanDeg: 45, meanAnomaly0Deg: 90, category: 'Weather' },
  { id: 'tgo', name: 'ExoMars Trace Gas Orbiter (ESA)', body: 'mars', radiusKm: MARS_RADIUS_KM + 400, periodMinutes: 120, inclinationDeg: 74, raanDeg: 90, meanAnomaly0Deg: 180, category: 'Science' },
  { id: 'hope', name: 'Hope (UAE)', body: 'mars', radiusKm: MARS_RADIUS_KM + 31500, periodMinutes: 55 * 60, inclinationDeg: 25, raanDeg: 320, meanAnomaly0Deg: 210, category: 'Weather' },
  { id: 'tianwen1', name: 'Tianwen-1 Orbiter (CNSA)', body: 'mars', radiusKm: MARS_RADIUS_KM + 6100, periodMinutes: 470, inclinationDeg: 87, raanDeg: 260, meanAnomaly0Deg: 100, category: 'Earth Observation' },
];

function propagateOrbiter(def: OrbiterDef, date: Date): OrbiterPosition {
  const t = date.getTime() / (1000 * 60);
  const M = ((def.meanAnomaly0Deg + (360 / def.periodMinutes) * t) % 360 + 360) % 360;
  const Mrad = (M * Math.PI) / 180;
  const irad = (def.inclinationDeg * Math.PI) / 180;
  const raanRad = (def.raanDeg * Math.PI) / 180;
  const xOrb = def.radiusKm * Math.cos(Mrad);
  const yOrb = def.radiusKm * Math.sin(Mrad);
  const cosI = Math.cos(irad);
  const sinI = Math.sin(irad);
  const cosR = Math.cos(raanRad);
  const sinR = Math.sin(raanRad);
  const x = cosR * xOrb - sinR * cosI * yOrb;
  const y = sinR * xOrb + cosR * cosI * yOrb;
  const z = sinI * yOrb;
  const r = Math.sqrt(x * x + y * y + z * z);
  const lat = (Math.asin(z / r) * 180) / Math.PI;
  const lng = (Math.atan2(y, x) * 180) / Math.PI;
  const bodyRadius = def.body === 'moon' ? MOON_RADIUS_KM : MARS_RADIUS_KM;
  const alt = r - bodyRadius;
  return {
    id: 'orb-' + def.id,
    name: def.name,
    lat,
    lng,
    alt,
    category: def.category,
    periodMinutes: def.periodMinutes,
    inclinationDeg: def.inclinationDeg,
    body: def.body,
  };
}

export function getMoonOrbiters(date: Date): OrbiterPosition[] {
  return MOON_ORBITERS.map((d) => propagateOrbiter(d, date));
}

export function getMarsOrbiters(date: Date): OrbiterPosition[] {
  return MARS_ORBITERS.map((d) => propagateOrbiter(d, date));
}

export interface OrbiterOrbitPath {
  id: string;
  name: string;
  category: string;
  coords: Array<{ lat: number; lng: number; alt: number }>;
}

export function computeOrbiterPath(
  orbiterId: string,
  body: 'moon' | 'mars',
  steps: number = 180
): OrbiterOrbitPath | null {
  const defId = orbiterId.startsWith('orb-') ? orbiterId.slice(4) : orbiterId;
  const list = body === 'moon' ? MOON_ORBITERS : MARS_ORBITERS;
  const def = list.find((d) => d.id === defId);
  if (!def) return null;

  const bodyRadius = body === 'moon' ? MOON_RADIUS_KM : MARS_RADIUS_KM;
  const coords: Array<{ lat: number; lng: number; alt: number }> = [];
  const now = Date.now();
  const periodMs = def.periodMinutes * 60 * 1000;
  const stepMs = periodMs / steps;

  for (let i = 0; i <= steps; i++) {
    const date = new Date(now + i * stepMs);
    const pos = propagateOrbiter(def, date);
    coords.push({
      lat: pos.lat,
      lng: pos.lng,
      alt: pos.alt / bodyRadius,
    });
  }

  return {
    id: `path-${orbiterId}`,
    name: def.name,
    category: def.category,
    coords,
  };
}

export { MOON_RADIUS_KM, MARS_RADIUS_KM };
