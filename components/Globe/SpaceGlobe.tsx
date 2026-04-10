import { useRef, useEffect, useState, useCallback, useMemo, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import type { GlobeMethods } from 'react-globe.gl';
import * as THREE from 'three';
import { century, equationOfTime, declination } from 'solar-calculator';
import {
  SatellitePosition,
  SatelliteOrbitPath,
  clearSatelliteCatalog,
  parseSatelliteData,
  propagatePositions,
  computeOrbitPath,
  searchSatellites,
} from '../../lib/satellites';
import {
  Launch,
  fetchLaunches,
  fetchSatelliteData,
  filterLaunchesByDestination,
} from '../../lib/launches';
import { getMoonOrbiters, getMarsOrbiters, computeOrbiterPath, MOON_RADIUS_KM, MARS_RADIUS_KM, type OrbiterPosition } from '../../lib/orbiters';
import ControlsPanel, { type PlanetBodyId } from './ControlsPanel';
import InfoPanel from './InfoPanel';
import SearchResultsPanel, { type SearchResult } from './SearchResultsPanel';
import styles from '../../styles/Globe.module.css';

function getSubsolarPoint(date: Date): [number, number] {
  const dt = +date;
  const dayStart = new Date(date).setUTCHours(0, 0, 0, 0);
  const t = century(dt);
  const longitude = ((dayStart - dt) / 864e5) * 360 - 180;
  const lng = longitude - equationOfTime(t) / 4;
  const lat = declination(t);
  return [lng, lat];
}

const DAY_NIGHT_VERT = `
  varying vec3 vNormal;
  varying vec2 vUv;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const DAY_NIGHT_FRAG = `
  #define PI 3.141592653589793
  uniform sampler2D dayTexture;
  uniform sampler2D nightTexture;
  uniform vec2 sunPosition;
  uniform vec2 globeRotation;
  varying vec3 vNormal;
  varying vec2 vUv;

  float toRad(in float a) {
    return a * PI / 180.0;
  }

  vec3 Polar2Cartesian(in vec2 c) {
    float theta = toRad(90.0 - c.x);
    float phi = toRad(90.0 - c.y);
    return vec3(sin(phi) * cos(theta), cos(phi), sin(phi) * sin(theta));
  }

  void main() {
    float invLon = toRad(globeRotation.x);
    float invLat = -toRad(globeRotation.y);
    mat3 rotX = mat3(
      1.0, 0.0, 0.0,
      0.0, cos(invLat), -sin(invLat),
      0.0, sin(invLat), cos(invLat)
    );
    mat3 rotY = mat3(
      cos(invLon), 0.0, sin(invLon),
      0.0, 1.0, 0.0,
      -sin(invLon), 0.0, cos(invLon)
    );
    vec3 rotatedSunDirection = rotX * rotY * Polar2Cartesian(sunPosition);
    float intensity = dot(normalize(vNormal), normalize(rotatedSunDirection));
    vec4 dayColor = texture2D(dayTexture, vUv);
    vec4 nightColor = texture2D(nightTexture, vUv);
    float blendFactor = smoothstep(-0.15, 0.15, intensity);
    gl_FragColor = mix(nightColor, dayColor, blendFactor);
  }
`;

const DAY_URL =
  'https://upload.wikimedia.org/wikipedia/commons/0/04/Solarsystemscope_texture_8k_earth_daymap.jpg';
const NIGHT_URL =
  'https://upload.wikimedia.org/wikipedia/commons/b/b3/Solarsystemscope_texture_8k_earth_nightmap.jpg';
const DAY_BUMP_URL = 'https://unpkg.com/three-globe/example/img/earth-topology.png';

const GLOBE_CONFIGS = [
  { id: 'earth', label: 'Earth', textureUrl: DAY_URL, nightUrl: NIGHT_URL, bumpUrl: DAY_BUMP_URL, useDayNight: true, showEarthData: true },
  { id: 'moon', label: 'Moon', textureUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d1/Solarsystemscope_texture_8k_moon.jpg', nightUrl: null, bumpUrl: null, useDayNight: false, showEarthData: false },
  { id: 'mars', label: 'Mars', textureUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/70/Solarsystemscope_texture_8k_mars.jpg', nightUrl: null, bumpUrl: null, useDayNight: false, showEarthData: false },
] as const;

const GlobeGL = dynamic(() => import('react-globe.gl'), { ssr: false });

const SIDEBAR_WIDTH_PX = 380;
const LEFT_RAIL_WIDTH_PX = 240;
const STAGE_BREAKPOINT = 900;

type SearchPickPending = { kind: 'sat'; norad: number } | { kind: 'orb'; id: string };

/** Earth default camera distance (globe radii from center); lower = closer / larger on screen */
const EARTH_INITIAL_ALTITUDE = 1.68;
/** Default Earth POV: Arabian Sea / Middle East–India (matches landing view, not Atlantic/Africa). */
const EARTH_INITIAL_LAT = 20;
const EARTH_INITIAL_LNG = 58;
const MOON_MARS_INITIAL_ALTITUDE = 2.5;

const EARTH_RADIUS_KM = 6371;

const LAUNCH_POINT_SIZE = 0.6;

const satMaterialCache: Record<string, THREE.MeshBasicMaterial> = {};
const panelMaterial = typeof window !== 'undefined'
  ? new THREE.MeshBasicMaterial({ color: '#1d9bf0', transparent: true, opacity: 0.8 })
  : null;

const CATEGORY_COLORS: Record<string, string> = {
  Station: '#ff6d00',
  Constellation: '#8899a6',
  Navigation: '#00c853',
  Weather: '#1d9bf0',
  Science: '#e040fb',
  Communications: '#ffab00',
  'Earth Observation': '#4caf50',
  Cargo: '#9c27b0',
  Crew: '#2196f3',
  Debris: '#555555',
  Military: '#ef5350',
  Private: '#ce93d8',
  Other: '#546e7a',
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.Other;
}

function getSatMaterial(category: string): THREE.MeshBasicMaterial {
  const color = getCategoryColor(category);
  if (!satMaterialCache[color]) {
    satMaterialCache[color] = new THREE.MeshBasicMaterial({ color });
  }
  return satMaterialCache[color];
}

const ISS_NORAD_ID = 25544;
const CSS_NORAD_IDS = [48274, 53239, 54216]; // Tianhe, Wentian, Mengtian

function isCSS(sat: SatellitePosition): boolean {
  const n = sat.name.toUpperCase();
  return (
    CSS_NORAD_IDS.includes(sat.noradId) ||
    /^CSS\s*\(/i.test(sat.name) ||
    (sat.category === 'Station' && /TIANHE|WENTIAN|MENGTIAN|TIANGONG/i.test(n))
  );
}

const STATION_SCALE = 2.15;

function createISSObject(): THREE.Group {
  const group = new THREE.Group();
  const s = STATION_SCALE;
  const whiteMat = new THREE.MeshBasicMaterial({ color: '#e0e0e0' });
  const blueMat = new THREE.MeshBasicMaterial({ color: '#1d9bf0' });
  const goldMat = new THREE.MeshBasicMaterial({ color: '#ffd54f' });

  const truss = new THREE.Mesh(
    new THREE.BoxGeometry(2.2 * s, 0.12 * s, 0.12 * s),
    whiteMat
  );
  group.add(truss);

  const nodeGeom = new THREE.CylinderGeometry(0.15 * s, 0.15 * s, 0.2 * s, 8);
  const node1 = new THREE.Mesh(nodeGeom, whiteMat);
  node1.position.set(0, 0, 0);
  group.add(node1);
  const node2 = new THREE.Mesh(nodeGeom.clone(), whiteMat);
  node2.position.set(0.3 * s, 0.15 * s, 0);
  node2.rotation.z = Math.PI / 6;
  group.add(node2);
  const node3 = new THREE.Mesh(nodeGeom.clone(), whiteMat);
  node3.position.set(-0.3 * s, 0.12 * s, 0);
  node3.rotation.z = -Math.PI / 6;
  group.add(node3);

  const wingGeom = new THREE.BoxGeometry(0.08 * s, 0.9 * s, 0.5 * s);
  const positions = [-1.0, -0.5, 0.5, 1.0];
  positions.forEach((x) => {
    const wingL = new THREE.Mesh(wingGeom, blueMat);
    wingL.position.set(x * s, 0.45 * s, 0);
    wingL.rotation.x = Math.PI / 2;
    group.add(wingL);
    const wingR = new THREE.Mesh(wingGeom.clone(), blueMat);
    wingR.position.set(x * s, -0.45 * s, 0);
    wingR.rotation.x = -Math.PI / 2;
    group.add(wingR);
  });

  const labGeom = new THREE.CylinderGeometry(0.2 * s, 0.2 * s, 0.6 * s, 8);
  const lab = new THREE.Mesh(labGeom, whiteMat);
  lab.position.set(0.6 * s, 0.25 * s, 0);
  lab.rotation.z = -Math.PI / 4;
  group.add(lab);

  const cupola = new THREE.Mesh(
    new THREE.SphereGeometry(0.12 * s, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    goldMat
  );
  cupola.position.set(0.5 * s, 0.35 * s, 0.1 * s);
  group.add(cupola);

  return group;
}

function createCSSObject(): THREE.Group {
  const group = new THREE.Group();
  const s = STATION_SCALE;
  const whiteMat = new THREE.MeshBasicMaterial({ color: '#e8e8e8' });
  const blueMat = new THREE.MeshBasicMaterial({ color: '#1d9bf0' });
  const redMat = new THREE.MeshBasicMaterial({ color: '#de2910' });

  // Tianhe core module: long cylinder (16.6m body, 4.2m diameter)
  const coreGeom = new THREE.CylinderGeometry(0.22 * s, 0.22 * s, 1.5 * s, 10);
  const core = new THREE.Mesh(coreGeom, whiteMat);
  core.rotation.z = Math.PI / 2;
  group.add(core);

  // Forward docking node (node cabin)
  const nodeGeom = new THREE.CylinderGeometry(0.18 * s, 0.22 * s, 0.25 * s, 10);
  const node = new THREE.Mesh(nodeGeom, whiteMat);
  node.rotation.z = Math.PI / 2;
  node.position.set(0.88 * s, 0, 0);
  group.add(node);

  // Docking hub accent (red, Chinese flag color)
  const hubGeom = new THREE.CylinderGeometry(0.1 * s, 0.1 * s, 0.08 * s, 8);
  const hub = new THREE.Mesh(hubGeom, redMat);
  hub.rotation.z = Math.PI / 2;
  hub.position.set(1.0 * s, 0, 0);
  group.add(hub);

  // Two large solar arrays (Tianhe has 2 steerable arrays)
  const wingGeom = new THREE.BoxGeometry(0.04 * s, 1.0 * s, 0.35 * s);
  const wingPositions = [-0.35 * s, 0.35 * s];
  wingPositions.forEach((x) => {
    const wingL = new THREE.Mesh(wingGeom, blueMat);
    wingL.position.set(x, 0.55 * s, 0);
    wingL.rotation.x = Math.PI / 2;
    group.add(wingL);
    const wingR = new THREE.Mesh(wingGeom.clone(), blueMat);
    wingR.position.set(x, -0.55 * s, 0);
    wingR.rotation.x = -Math.PI / 2;
    group.add(wingR);
  });

  // Wentian lab module (perpendicular to core, T-config)
  const labGeom = new THREE.CylinderGeometry(0.14 * s, 0.14 * s, 0.55 * s, 8);
  const labWentian = new THREE.Mesh(labGeom, whiteMat);
  labWentian.position.set(-0.5 * s, 0.5 * s, 0);
  labWentian.rotation.z = -Math.PI / 2;
  labWentian.rotation.x = Math.PI / 4;
  group.add(labWentian);

  // Mengtian lab module (other arm of T)
  const labMengtian = new THREE.Mesh(labGeom.clone(), whiteMat);
  labMengtian.position.set(0.5 * s, 0.48 * s, 0);
  labMengtian.rotation.z = Math.PI / 2;
  labMengtian.rotation.x = Math.PI / 4;
  group.add(labMengtian);

  return group;
}

const sharedSphereGeom = typeof window !== 'undefined' ? new THREE.SphereGeometry(0.15, 6, 4) : null;

function createSatObject(d: object): THREE.Group {
  const sat = d as SatellitePosition & { noradId?: number };
  if (sat.noradId === ISS_NORAD_ID || (sat.category === 'Station' && /^ISS\s*\(ZARYA\)/i.test(sat.name))) {
    return createISSObject();
  }
  if (isCSS(sat)) {
    return createCSSObject();
  }

  const group = new THREE.Group();
  const mat = getSatMaterial(sat.category);
  const dot = new THREE.Mesh(sharedSphereGeom!, mat);
  group.add(dot);
  return group;
}

const orbiterBodyMaterial = typeof window !== 'undefined'
  ? new THREE.MeshBasicMaterial({ color: '#c0c0c0' })
  : null;
const orbiterAntennaMaterial = typeof window !== 'undefined'
  ? new THREE.MeshBasicMaterial({ color: '#a0a0a0' })
  : null;

function createOrbiterObject(_d: object): THREE.Group {
  const s = 1.8;
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.35 * s, 0.35 * s, 0.35 * s), orbiterBodyMaterial!);
  group.add(body);
  const panelL = new THREE.Mesh(new THREE.BoxGeometry(0.8 * s, 0.03 * s, 0.4 * s), panelMaterial!);
  panelL.position.set(-0.55 * s, 0, 0);
  group.add(panelL);
  const panelR = new THREE.Mesh(new THREE.BoxGeometry(0.8 * s, 0.03 * s, 0.4 * s), panelMaterial!);
  panelR.position.set(0.55 * s, 0, 0);
  group.add(panelR);
  const antenna = new THREE.Mesh(new THREE.ConeGeometry(0.08 * s, 0.22 * s, 6), orbiterAntennaMaterial!);
  antenna.position.set(0, 0.28 * s, 0);
  group.add(antenna);
  return group;
}

function generateNightPolygon(date: Date) {
  const [sunLng, sunLat] = getSubsolarPoint(date);
  const sunLatRad = (sunLat * Math.PI) / 180;
  const sunLngRad = (sunLng * Math.PI) / 180;
  const steps = 120;
  const coords: [number, number][] = [];

  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const lat = Math.asin(
      Math.sin(sunLatRad) * Math.cos(Math.PI / 2) +
        Math.cos(sunLatRad) * Math.sin(Math.PI / 2) * Math.cos(angle)
    );
    const lng =
      sunLngRad +
      Math.atan2(
        Math.sin(angle) * Math.sin(Math.PI / 2) * Math.cos(sunLatRad),
        Math.cos(Math.PI / 2) - Math.sin(sunLatRad) * Math.sin(lat)
      );
    const latDeg = (lat * 180) / Math.PI;
    let lngDeg = (lng * 180) / Math.PI;
    lngDeg = ((lngDeg + 540) % 360) - 180;
    coords.push([lngDeg, latDeg]);
  }

  return {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'Polygon' as const,
      coordinates: [
        [[-180, 90], [180, 90], [180, -90], [-180, -90], [-180, 90]],
        coords,
      ],
    },
  };
}

type PlanetSlideFrom = '100%' | '-100%';

interface PlanetViewState {
  id: string;
  slideFrom: PlanetSlideFrom;
  /** When false, no slide-in animation (initial Earth view). */
  hasSwitched: boolean;
}

export default function SpaceGlobe() {
  const globeRef = useRef<GlobeMethods>();
  const catalogCacheRef = useRef<any[] | null>(null);
  const catalogInflightRef = useRef<Promise<any[]> | null>(null);
  const [launchDataLoading, setLaunchDataLoading] = useState(true);
  const [overlayEnabled, setOverlayEnabled] = useState<Record<PlanetBodyId, boolean>>({
    earth: false,
    moon: false,
    mars: false,
  });
  const [satellitesLoading, setSatellitesLoading] = useState(false);
  /** Bumped after Earth catalog parse succeeds so the RAF interpolation loop re-initializes with populated TLEs. */
  const [satCatalogGeneration, setSatCatalogGeneration] = useState(0);
  const [highlightPadKey, setHighlightPadKey] = useState<string | null>(null);
  const [satellitePositions, setSatellitePositions] = useState<SatellitePosition[]>([]);
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [selectedSatellite, setSelectedSatellite] = useState<SatellitePosition | null>(null);
  const [selectedLaunches, setSelectedLaunches] = useState<Launch[] | null>(null);
  const [planetView, setPlanetView] = useState<PlanetViewState>({
    id: 'earth',
    slideFrom: '100%',
    hasSwitched: false,
  });
  const selectedGlobeId = planetView.id;
  const [orbiterPositions, setOrbiterPositions] = useState<OrbiterPosition[]>([]);
  const [selectedOrbiter, setSelectedOrbiter] = useState<OrbiterPosition | null>(null);
  const [nightPolygon, setNightPolygon] = useState<any>(null);
  const [dayNightMaterial, setDayNightMaterial] = useState<THREE.ShaderMaterial | null>(null);
  const sunPosRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const [globeReady, setGlobeReady] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchPickPending, setSearchPickPending] = useState<SearchPickPending | null>(null);
  const rendererConfig = useMemo(
    () => ({
      antialias: true,
      powerPreference: 'high-performance' as const,
      pixelRatio: typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1,
    }),
    []
  );

  useEffect(() => {
    const update = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchQuery), 280);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    setSearchQuery('');
    setSearchPickPending(null);
  }, [selectedGlobeId]);

  /** Arrow keys cycle planets (no touch / pointer swipe on the globe). */
  useEffect(() => {
    const n = GLOBE_CONFIGS.length;

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target;
      if (target instanceof HTMLElement) {
        if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
      }
      const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (delta === 0) return;
      e.preventDefault();

      setPlanetView((pv) => {
        const idx = GLOBE_CONFIGS.findIndex((g) => g.id === pv.id);
        if (idx < 0) return pv;
        const nextId = GLOBE_CONFIGS[(idx + delta + n) % n].id;
        if (nextId === pv.id) return pv;
        return {
          ...pv,
          id: nextId,
          slideFrom: delta > 0 ? '100%' : '-100%',
          hasSwitched: true,
        };
      });
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const ensureFullCatalog = useCallback(async () => {
    if (catalogCacheRef.current) return catalogCacheRef.current;
    if (!catalogInflightRef.current) {
      catalogInflightRef.current = (async () => {
        try {
          const d = await fetchSatelliteData('full');
          const data = Array.isArray(d) ? d : [];
          catalogCacheRef.current = data;
          return data;
        } finally {
          catalogInflightRef.current = null;
        }
      })();
    }
    return catalogInflightRef.current;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLaunchDataLoading(true);
      try {
        const launchData = await fetchLaunches();
        if (cancelled) return;
        const validLaunches = (launchData || []).filter(
          (l: Launch) => l.lat != null && l.lng != null
        );
        setLaunches(validLaunches);
      } catch (err) {
        console.error('Launch data load error:', err);
      } finally {
        if (!cancelled) setLaunchDataLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (overlayEnabled.earth) return;
    clearSatelliteCatalog();
    setSatellitePositions([]);
    setSelectedSatellite(null);
  }, [overlayEnabled.earth]);

  useEffect(() => {
    if (!overlayEnabled.earth) return;
    let cancelled = false;
    (async () => {
      setSatellitesLoading(true);
      try {
        const satData = await ensureFullCatalog();
        if (cancelled) return;
        if (satData?.length > 0) {
          parseSatelliteData(satData, { excludeDebris: false });
          setSatellitePositions(propagatePositions(new Date()));
          setSelectedSatellite(null);
          setSatCatalogGeneration((g) => g + 1);
        } else {
          setSatellitePositions([]);
        }
      } catch (err) {
        console.error('Satellite catalog load error:', err);
        if (!cancelled) setSatellitePositions([]);
      } finally {
        if (!cancelled) setSatellitesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [overlayEnabled.earth, ensureFullCatalog]);

  useEffect(() => {
    if (!overlayEnabled.earth || selectedGlobeId !== 'earth') return;

    let rafId: number;
    let lastPropTime = 0;
    let lastCommitTime = 0;
    const PROP_INTERVAL = 1000; // recompute SGP4 every 1s
    const MIN_COMMIT_MS = 100; // limit React + GlobeGL objectsData updates (~10/s)

    let prevPositions: SatellitePosition[] = [];
    let nextPositions: SatellitePosition[] = [];
    let interpStart = Date.now();

    const propagate = () => {
      prevPositions = nextPositions.length > 0 ? nextPositions : propagatePositions(new Date());
      nextPositions = propagatePositions(new Date(Date.now() + PROP_INTERVAL));
      interpStart = Date.now();
    };
    propagate();
    if (prevPositions.length > 0) {
      setSatellitePositions(prevPositions);
    }
    lastCommitTime = Date.now();

    const tick = () => {
      const now = Date.now();
      if (now - lastPropTime >= PROP_INTERVAL) {
        lastPropTime = now;
        propagate();
      }
      const t = Math.min((now - interpStart) / PROP_INTERVAL, 1);
      if (
        now - lastCommitTime >= MIN_COMMIT_MS &&
        prevPositions.length === nextPositions.length &&
        prevPositions.length > 0
      ) {
        lastCommitTime = now;
        const interpolated = prevPositions.map((prev, i) => {
          const next = nextPositions[i];
          return {
            ...prev,
            lat: prev.lat + (next.lat - prev.lat) * t,
            lng: prev.lng + (next.lng - prev.lng) * t,
            alt: prev.alt + (next.alt - prev.alt) * t,
          };
        });
        setSatellitePositions(interpolated);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
  }, [overlayEnabled.earth, selectedGlobeId, satCatalogGeneration]);

  useEffect(() => {
    if (selectedGlobeId === 'earth') {
      setSelectedOrbiter(null);
    } else {
      setSelectedSatellite(null);
    }
  }, [selectedGlobeId]);

  useEffect(() => {
    if (selectedGlobeId !== 'moon' && selectedGlobeId !== 'mars') {
      setOrbiterPositions([]);
      return;
    }
    const body = selectedGlobeId as 'moon' | 'mars';
    if (!overlayEnabled[body]) {
      setOrbiterPositions([]);
      setSelectedOrbiter(null);
      return;
    }
    const tick = () => {
      const now = new Date();
      setOrbiterPositions(body === 'moon' ? getMoonOrbiters(now) : getMarsOrbiters(now));
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [selectedGlobeId, overlayEnabled.moon, overlayEnabled.mars]);

  useEffect(() => {
    if (selectedGlobeId !== 'earth') {
      setNightPolygon(null);
      setDayNightMaterial(null);
      return;
    }
    const loader = new THREE.TextureLoader();
    let fallbackInterval: ReturnType<typeof setInterval> | undefined;
    Promise.all([
      loader.loadAsync(DAY_URL),
      loader.loadAsync(NIGHT_URL),
    ]).then(([dayTex, nightTex]) => {
      const [lng, lat] = getSubsolarPoint(new Date());
      sunPosRef.current.set(lng, lat);
      const r = globeRef.current?.renderer?.();
      const cap = r ? Math.min(4, r.capabilities.getMaxAnisotropy()) : 4;
      dayTex.anisotropy = cap;
      nightTex.anisotropy = cap;
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          dayTexture: { value: dayTex },
          nightTexture: { value: nightTex },
          sunPosition: { value: sunPosRef.current.clone() },
          globeRotation: { value: new THREE.Vector2(0, 0) },
        },
        vertexShader: DAY_NIGHT_VERT,
        fragmentShader: DAY_NIGHT_FRAG,
      });
      setDayNightMaterial(mat);
    }).catch(() => {
      setNightPolygon(generateNightPolygon(new Date()));
      fallbackInterval = setInterval(() => setNightPolygon(generateNightPolygon(new Date())), 60000);
    });
    return () => { if (fallbackInterval) clearInterval(fallbackInterval); };
  }, [selectedGlobeId]);

  useEffect(() => {
    if (!dayNightMaterial) return;
    const updateSun = () => {
      const [lng, lat] = getSubsolarPoint(new Date());
      dayNightMaterial.uniforms.sunPosition.value.set(lng, lat);
    };
    updateSun();
    const sunInterval = setInterval(updateSun, 30000);
    return () => clearInterval(sunInterval);
  }, [dayNightMaterial]);

  useEffect(() => {
    if (!dayNightMaterial) return;
    const t = requestAnimationFrame(() => {
      const glRenderer = globeRef.current?.renderer?.();
      if (!glRenderer) return;
      const cap = Math.min(4, glRenderer.capabilities.getMaxAnisotropy());
      const dayTex = dayNightMaterial.uniforms.dayTexture?.value as THREE.Texture | undefined;
      const nightTex = dayNightMaterial.uniforms.nightTexture?.value as THREE.Texture | undefined;
      if (dayTex) {
        dayTex.anisotropy = cap;
        dayTex.needsUpdate = true;
      }
      if (nightTex) {
        nightTex.anisotropy = cap;
        nightTex.needsUpdate = true;
      }
    });
    return () => cancelAnimationFrame(t);
  }, [dayNightMaterial]);

  const handleZoom = useCallback(
    (pov: { lat: number; lng: number; altitude: number }) => {
      if (dayNightMaterial) {
        dayNightMaterial.uniforms.globeRotation.value.set(pov.lng, pov.lat);
      }
    },
    [dayNightMaterial]
  );

  // Orbit path for selected satellite or orbiter (shown when clicking)
  const selectedOrbitPath = useMemo(() => {
    if (selectedSatellite) {
      return computeOrbitPath(selectedSatellite.noradId, selectedSatellite.period || 90, 180);
    }
    if (selectedOrbiter && selectedGlobeId === selectedOrbiter.body) {
      return computeOrbiterPath(selectedOrbiter.id, selectedOrbiter.body, 180);
    }
    return null;
  }, [selectedSatellite, selectedOrbiter, selectedGlobeId]);

  const handleGlobeReady = useCallback(() => {
    setTimeout(() => {
      const globe = globeRef.current;
      if (!globe || typeof globe.pointOfView !== 'function') return;

      const initialAlt =
        selectedGlobeId === 'earth' ? EARTH_INITIAL_ALTITUDE : MOON_MARS_INITIAL_ALTITUDE;
      const initLat = selectedGlobeId === 'earth' ? EARTH_INITIAL_LAT : 28;
      const initLng = selectedGlobeId === 'earth' ? EARTH_INITIAL_LNG : -38;
      globe.pointOfView({ lat: initLat, lng: initLng, altitude: initialAlt }, 0);

      if (dayNightMaterial) {
        dayNightMaterial.uniforms.globeRotation.value.set(initLng, initLat);
      }

      try {
        const glRenderer = globe.renderer();
        if (glRenderer) {
          glRenderer.setPixelRatio(Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1));
        }
        const controls = globe.controls();
        if (controls) {
          controls.autoRotate = true;
          controls.autoRotateSpeed = 0.3;
          controls.enableDamping = true;
          controls.dampingFactor = 0.1;
          controls.minDistance = 100.15;
          controls.maxDistance = 1000;
        }
      } catch {
        // controls may not be available yet
      }

      setGlobeReady(true);
    }, 100);
  }, [dayNightMaterial, selectedGlobeId]);

  const handleSatelliteClick = useCallback(
    (point: object) => {
      const sat = point as SatellitePosition;
      setHighlightPadKey(null);
      setSelectedSatellite(sat);
      setSelectedOrbiter(null);
      setSelectedLaunches(null);
    },
    []
  );

  const handleOrbiterClick = useCallback(
    (point: object) => {
      const orb = point as OrbiterPosition;
      setHighlightPadKey(null);
      setSelectedOrbiter(orb);
      setSelectedSatellite(null);
      setSelectedLaunches(null);
      const globe = globeRef.current;
      if (globe && typeof globe.pointOfView === 'function') {
        const bodyRadius = orb.body === 'moon' ? MOON_RADIUS_KM : MARS_RADIUS_KM;
        const altNorm = Math.max(orb.alt / bodyRadius, 0.06);
        globe.pointOfView({ lat: orb.lat, lng: orb.lng, altitude: 1 + altNorm }, 800);
      }
    },
    []
  );

  const handleLaunchClick = useCallback(
    (point: object) => {
      const loc = point as { lat: number; lng: number; padKey?: string; launches: Launch[] };
      const pk =
        loc.padKey ?? `${Number(loc.lat).toFixed(3)}_${Number(loc.lng).toFixed(3)}`;
      setHighlightPadKey(pk);
      setSelectedLaunches(loc?.launches || null);
      setSelectedSatellite(null);
      setSelectedOrbiter(null);
    },
    []
  );

  const handleClosePanel = useCallback(() => {
    setHighlightPadKey(null);
    setSelectedSatellite(null);
    setSelectedOrbiter(null);
    setSelectedLaunches(null);
  }, []);

  const searchResults = useMemo((): SearchResult[] => {
    const q = debouncedSearch.trim();
    if (q.length < 2) return [];
    if (selectedGlobeId === 'earth') {
      return searchSatellites(q).map((s) => ({
        type: 'satellite' as const,
        noradId: s.noradId,
        name: s.name,
        category: s.category,
      }));
    }
    if (selectedGlobeId === 'moon' || selectedGlobeId === 'mars') {
      const body = selectedGlobeId as 'moon' | 'mars';
      const ql = q.toLowerCase();
      return orbiterPositions
        .filter((o) => o.body === body && o.name.toLowerCase().includes(ql))
        .map((o) => ({
          type: 'orbiter' as const,
          id: o.id,
          name: o.name,
          category: o.category,
          lat: o.lat,
          lng: o.lng,
          alt: o.alt,
          body: o.body,
        }));
    }
    return [];
  }, [debouncedSearch, selectedGlobeId, orbiterPositions]);

  const setBodyOverlay = useCallback((enabled: boolean) => {
    const id = selectedGlobeId as PlanetBodyId;
    setOverlayEnabled((prev) => ({ ...prev, [id]: enabled }));
  }, [selectedGlobeId]);

  const bodyOverlayOn = overlayEnabled[selectedGlobeId as PlanetBodyId];

  const handleSearchSelect = useCallback(
    (r: SearchResult) => {
      setBodyOverlay(true);
      setSearchQuery('');
      if (r.type === 'satellite') {
        const sat = satellitePositions.find((s) => s.noradId === r.noradId);
        if (sat) {
          handleSatelliteClick(sat);
        } else {
          setSearchPickPending({ kind: 'sat', norad: r.noradId });
        }
      } else {
        const orb = orbiterPositions.find((o) => o.id === r.id);
        if (orb) {
          handleOrbiterClick(orb);
        } else {
          setSearchPickPending({ kind: 'orb', id: r.id });
        }
      }
    },
    [satellitePositions, orbiterPositions, setBodyOverlay, handleSatelliteClick, handleOrbiterClick]
  );

  useEffect(() => {
    if (!searchPickPending) return;
    if (searchPickPending.kind === 'sat') {
      const sat = satellitePositions.find((s) => s.noradId === searchPickPending.norad);
      if (sat) {
        handleSatelliteClick(sat);
        setSearchPickPending(null);
      }
    } else {
      const orb = orbiterPositions.find((o) => o.id === searchPickPending.id);
      if (orb) {
        handleOrbiterClick(orb);
        setSearchPickPending(null);
      }
    }
  }, [searchPickPending, satellitePositions, orbiterPositions, handleSatelliteClick, handleOrbiterClick]);

  const satPointsData = useMemo(() => satellitePositions, [satellitePositions]);

  const orbiterPointsData = useMemo(() => {
    if (selectedGlobeId !== 'moon' && selectedGlobeId !== 'mars') return [];
    return orbiterPositions;
  }, [selectedGlobeId, orbiterPositions]);

  const globeObjectsData = useMemo(() => {
    if (selectedGlobeId === 'earth') {
      return overlayEnabled.earth ? satPointsData : [];
    }
    if (selectedGlobeId === 'moon') return overlayEnabled.moon ? orbiterPointsData : [];
    if (selectedGlobeId === 'mars') return overlayEnabled.mars ? orbiterPointsData : [];
    return [];
  }, [
    selectedGlobeId,
    overlayEnabled.earth,
    overlayEnabled.moon,
    overlayEnabled.mars,
    satPointsData,
    orbiterPointsData,
  ]);

  const launchPointsData = useMemo(() => {
    if (launches.length === 0) return [];
    const key = (l: Launch) => `${(l.lat ?? 0).toFixed(2)}_${(l.lng ?? 0).toFixed(2)}`;
    const byLoc = new Map<string, Launch[]>();
    for (const l of launches) {
      if (l.lat == null || l.lng == null) continue;
      const k = key(l);
      if (!byLoc.has(k)) byLoc.set(k, []);
      byLoc.get(k)!.push(l);
    }
    return Array.from(byLoc.entries()).map(([_, launchList]) => {
      const lat = launchList[0].lat!;
      const lng = launchList[0].lng!;
      return {
        lat,
        lng,
        padKey: `${lat.toFixed(3)}_${lng.toFixed(3)}`,
        launches: launchList,
        locationName: launchList[0].padLocation || launchList[0].padName || 'Launch site',
      };
    });
  }, [launches]);

  const upcomingLaunches = useMemo(() => {
    const now = Date.now();
    const dest = selectedGlobeId as 'earth' | 'moon' | 'mars';
    const filtered = filterLaunchesByDestination(launches, dest);
    return [...filtered]
      .filter((l) => {
        const ts = Date.parse(l.net);
        return Number.isFinite(ts) && ts >= now;
      })
      .sort((a, b) => Date.parse(a.net) - Date.parse(b.net))
      .slice(0, 16);
  }, [launches, selectedGlobeId]);

  const nightPolygonsData = useMemo(() => {
    if (!nightPolygon || dayNightMaterial) return [];
    return [nightPolygon];
  }, [nightPolygon, dayNightMaterial]);

  const pathsData = useMemo(() => {
    if (!selectedOrbitPath) return [];
    return [selectedOrbitPath];
  }, [selectedOrbitPath]);

  const currentGlobe = GLOBE_CONFIGS.find((g) => g.id === selectedGlobeId) || GLOBE_CONFIGS[0];
  const defaultGlobeUrl = currentGlobe.textureUrl;
  const bumpImageUrl = currentGlobe.bumpUrl;
  const useDayNight = currentGlobe.useDayNight && selectedGlobeId === 'earth';
  const showEarthData = currentGlobe.showEarthData;

  const isDesktopStage = dimensions.width >= STAGE_BREAKPOINT;
  const mobileSidebarH = Math.min(Math.round(dimensions.height * 0.38), 400);
  const globeWidth = isDesktopStage
    ? dimensions.width - LEFT_RAIL_WIDTH_PX - SIDEBAR_WIDTH_PX
    : dimensions.width;
  const globeHeight = isDesktopStage ? dimensions.height : dimensions.height - mobileSidebarH;

  if (dimensions.width === 0) return null;

  const brandClusterEl = (
    <div className={styles.brandCluster}>
      <div className={styles.logo}>
        <img src="/logo-proxima.png" alt="PROXIMA" />
      </div>
      <nav
        className={styles.planetPicker}
        aria-label="Planet (use Arrow Left and Arrow Right keys to change)"
        title="Change planet with the ← and → keyboard keys"
      >
        {GLOBE_CONFIGS.map((g) => (
          <span
            key={g.id}
            className={selectedGlobeId === g.id ? styles.planetLinkActive : styles.planetLink}
            aria-current={selectedGlobeId === g.id ? 'true' : undefined}
          >
            {g.label}
          </span>
        ))}
      </nav>
    </div>
  );

  return (
    <div className={styles.spaceRoot}>
      {!isDesktopStage && brandClusterEl}

      {(launchDataLoading || satellitesLoading) && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>
            {launchDataLoading
              ? 'Loading launch schedule...'
              : 'Updating satellites...'}
          </p>
        </div>
      )}

      <div className={styles.mainStage}>
        {isDesktopStage && <div className={styles.leftRail}>{brandClusterEl}</div>}
        <div className={styles.globeStage}>
          <div
            key={selectedGlobeId}
            className={`${styles.globeWrap}${planetView.hasSwitched ? ` ${styles.globeWrapPlanetEnter}` : ''}`}
            style={
              {
                ['--globe-slide-from' as string]: planetView.slideFrom,
              } as CSSProperties
            }
          >
            <GlobeGL
              key={selectedGlobeId}
              ref={globeRef}
              rendererConfig={rendererConfig}
              width={globeWidth}
              height={globeHeight}
              globeOffset={selectedGlobeId === 'earth' ? ([0, 0.11] as [number, number]) : [0, 0]}
              backgroundColor="rgba(0,0,0,0)"
              globeImageUrl={useDayNight && dayNightMaterial ? null : defaultGlobeUrl}
              globeMaterial={useDayNight && dayNightMaterial ? dayNightMaterial : undefined}
              bumpImageUrl={useDayNight && dayNightMaterial ? undefined : (bumpImageUrl || undefined)}
              showAtmosphere={true}
              atmosphereColor="#1d9bf0"
              atmosphereAltitude={0.15}
              onGlobeReady={handleGlobeReady}
              onZoom={handleZoom}
              objectsData={globeObjectsData}
              objectLat="lat"
              objectLng="lng"
              objectAltitude={(d: any) => {
                if (selectedGlobeId === 'moon') return Math.max((d.alt || 50) / MOON_RADIUS_KM, 0.06);
                if (selectedGlobeId === 'mars') return Math.max((d.alt || 300) / MARS_RADIUS_KM, 0.06);
                return Math.max((d.alt || 400) / EARTH_RADIUS_KM, 0.02);
              }}
              objectThreeObject={showEarthData ? createSatObject : createOrbiterObject}
              objectLabel={() => ''}
              onObjectClick={showEarthData ? handleSatelliteClick : handleOrbiterClick}
              pointsData={showEarthData ? launchPointsData : []}
              pointLat="lat"
              pointLng="lng"
              pointColor={(d: object) =>
                (d as { padKey?: string }).padKey === highlightPadKey ? '#ff6d00' : '#00c853'
              }
              pointAltitude={0.01}
              pointRadius={0.5}
              pointLabel={() => ''}
              onPointClick={(p: object) => handleLaunchClick(p)}
              polygonsData={showEarthData ? nightPolygonsData : []}
              polygonCapColor={() => 'rgba(0, 0, 20, 0.5)'}
              polygonSideColor={() => 'rgba(0, 0, 0, 0)'}
              polygonStrokeColor={() => 'rgba(0, 0, 0, 0)'}
              polygonAltitude={0.005}
              pathsData={pathsData}
              pathPoints="coords"
              pathPointLat="lat"
              pathPointLng="lng"
              pathPointAlt="alt"
              pathColor={() => 'rgba(255, 255, 255, 0.6)'}
              pathStroke={0.5}
              pathDashLength={10}
              pathDashGap={0}
              pathDashInitialGap={0}
              pathDashAnimateTime={0}
              pathTransitionDuration={0}
            />
          </div>

          <ControlsPanel
            body={selectedGlobeId as PlanetBodyId}
            overlayEnabled={bodyOverlayOn}
            onOverlayEnabledChange={setBodyOverlay}
            overlayLoading={showEarthData ? satellitesLoading : false}
          />
        </div>

        <aside className={styles.sidebarColumn}>
          <div className={styles.sidebarSearch}>
            <div className={styles.searchInputWrap}>
              <span className={styles.searchIcon} aria-hidden>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                  <path d="M20 20l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              <input
                type="search"
                className={styles.searchInput}
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search satellites or spacecraft"
                autoComplete="off"
              />
              {searchQuery.length > 0 && (
                <button
                  type="button"
                  className={styles.searchClearBtn}
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  x
                </button>
              )}
            </div>
            <SearchResultsPanel
              variant="sidebar"
              query={debouncedSearch}
              results={searchResults}
              isLoading={false}
              satellitesEnabled={bodyOverlayOn}
              onSelect={handleSearchSelect}
              onClose={() => setSearchQuery('')}
            />
          </div>
          <InfoPanel
            satellite={selectedSatellite}
            orbiter={selectedOrbiter}
            launches={selectedLaunches}
            upcomingLaunches={upcomingLaunches}
            globeId={selectedGlobeId}
            onClose={handleClosePanel}
          />
        </aside>
      </div>
    </div>
  );
}
