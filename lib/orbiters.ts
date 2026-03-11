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
  { id: 'lro', name: 'LRO', body: 'moon', radiusKm: MOON_RADIUS_KM + 50, periodMinutes: 113, inclinationDeg: 90, raanDeg: 0, meanAnomaly0Deg: 0, category: 'Science' },
  { id: 'capstone', name: 'CAPSTONE', body: 'moon', radiusKm: MOON_RADIUS_KM + 6000, periodMinutes: 6.5 * 24 * 60, inclinationDeg: 90, raanDeg: 0, meanAnomaly0Deg: 45, category: 'Science' },
  { id: 'danuri', name: 'Danuri', body: 'moon', radiusKm: MOON_RADIUS_KM + 100, periodMinutes: 120, inclinationDeg: 90, raanDeg: 30, meanAnomaly0Deg: 120, category: 'Science' },
  { id: 'chandrayaan3', name: 'Chandrayaan-3', body: 'moon', radiusKm: MOON_RADIUS_KM + 150, periodMinutes: 128, inclinationDeg: 90, raanDeg: 60, meanAnomaly0Deg: 200, category: 'Science' },
];

const MARS_ORBITERS: OrbiterDef[] = [
  { id: 'mro', name: 'MRO', body: 'mars', radiusKm: MARS_RADIUS_KM + 300, periodMinutes: 112, inclinationDeg: 93, raanDeg: 0, meanAnomaly0Deg: 0, category: 'Science' },
  { id: 'maven', name: 'MAVEN', body: 'mars', radiusKm: MARS_RADIUS_KM + 4000, periodMinutes: 262, inclinationDeg: 75, raanDeg: 45, meanAnomaly0Deg: 90, category: 'Science' },
  { id: 'tgo', name: 'TGO', body: 'mars', radiusKm: MARS_RADIUS_KM + 400, periodMinutes: 120, inclinationDeg: 74, raanDeg: 90, meanAnomaly0Deg: 180, category: 'Science' },
  { id: 'odyssey', name: 'Odyssey', body: 'mars', radiusKm: MARS_RADIUS_KM + 400, periodMinutes: 118, inclinationDeg: 93, raanDeg: 120, meanAnomaly0Deg: 270, category: 'Science' },
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
  return { id: 'orb-' + def.id, name: def.name, lat, lng, alt, category: def.category };
}

export function getMoonOrbiters(date: Date): OrbiterPosition[] {
  return MOON_ORBITERS.map((d) => propagateOrbiter(d, date));
}

export function getMarsOrbiters(date: Date): OrbiterPosition[] {
  return MARS_ORBITERS.map((d) => propagateOrbiter(d, date));
}

export { MOON_RADIUS_KM, MARS_RADIUS_KM };
