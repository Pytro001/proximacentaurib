import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { GlobeMethods } from 'react-globe.gl';
import * as THREE from 'three';
import { century, equationOfTime, declination } from 'solar-calculator';
import {
  SatellitePosition,
  SatelliteOrbitPath,
  parseSatelliteData,
  propagatePositions,
  computeOrbitPath,
  getSatelliteCount,
  searchSatellites,
} from '../../lib/satellites';
import {
  Launch,
  fetchLaunches,
  fetchSatelliteData,
  getLaunchStatusColor,
} from '../../lib/launches';
import { getMoonOrbiters, getMarsOrbiters, MOON_RADIUS_KM, MARS_RADIUS_KM } from '../../lib/orbiters';
import ControlsPanel from './ControlsPanel';
import InfoPanel from './InfoPanel';
import SearchResultsPanel from './SearchResultsPanel';
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

const DAY_URL = 'https://upload.wikimedia.org/wikipedia/commons/0/04/Solarsystemscope_texture_8k_earth_daymap.jpg';
const NIGHT_URL = 'https://upload.wikimedia.org/wikipedia/commons/b/b3/Solarsystemscope_texture_8k_earth_nightmap.jpg';
const DAY_BUMP_URL = '//unpkg.com/three-globe/example/img/earth-topology.png';

const GLOBE_CONFIGS = [
  { id: 'earth', label: 'Earth', textureUrl: DAY_URL, nightUrl: NIGHT_URL, bumpUrl: DAY_BUMP_URL, useDayNight: true, showEarthData: true },
  { id: 'moon', label: 'Moon', textureUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d1/Solarsystemscope_texture_8k_moon.jpg', nightUrl: null, bumpUrl: null, useDayNight: false, showEarthData: false },
  { id: 'mars', label: 'Mars', textureUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/70/Solarsystemscope_texture_8k_mars.jpg', nightUrl: null, bumpUrl: null, useDayNight: false, showEarthData: false },
] as const;

const GlobeGL = dynamic(() => import('react-globe.gl'), { ssr: false });

const EARTH_RADIUS_KM = 6371;
const LAUNCH_POINT_SIZE = 0.6;

const satMaterialCache: Record<string, THREE.MeshBasicMaterial> = {};
const panelMaterial = typeof window !== 'undefined'
  ? new THREE.MeshBasicMaterial({ color: '#1d9bf0', transparent: true, opacity: 0.8 })
  : null;

const CATEGORY_COLORS: Record<string, string> = {
  Station: '#ff6d00',
  Starlink: '#8899a6',
  Navigation: '#00c853',
  Weather: '#1d9bf0',
  Science: '#e040fb',
  Communications: '#ffab00',
  'Earth Observation': '#4caf50',
  Cargo: '#9c27b0',
  Crew: '#2196f3',
  Debris: '#757575',
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

function createSatObject(d: object): THREE.Group {
  const sat = d as SatellitePosition;
  if (sat.noradId === ISS_NORAD_ID || (sat.category === 'Station' && /^ISS\s*\(ZARYA\)/i.test(sat.name))) {
    return createISSObject();
  }
  if (isCSS(sat)) {
    return createCSSObject();
  }

  const group = new THREE.Group();
  const mat = getSatMaterial(sat.category);
  const s = 0.5; // smaller scale for regular satellites

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.35 * s, 0.35 * s, 0.35 * s), mat);
  group.add(body);

  const panelL = new THREE.Mesh(
    new THREE.BoxGeometry(0.8 * s, 0.03 * s, 0.4 * s),
    panelMaterial!
  );
  panelL.position.set(-0.55 * s, 0, 0);
  group.add(panelL);

  const panelR = new THREE.Mesh(
    new THREE.BoxGeometry(0.8 * s, 0.03 * s, 0.4 * s),
    panelMaterial!
  );
  panelR.position.set(0.55 * s, 0, 0);
  group.add(panelR);

  const antenna = new THREE.Mesh(
    new THREE.ConeGeometry(0.08 * s, 0.22 * s, 6),
    mat
  );
  antenna.position.set(0, 0.28 * s, 0);
  group.add(antenna);

  return group;
}

function createOrbiterObject(d: object): THREE.Group {
  const group = new THREE.Group();
  const mat = getSatMaterial('Science');
  const s = 0.4;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.4 * s, 0.4 * s, 0.4 * s), mat);
  group.add(body);
  const panelL = new THREE.Mesh(new THREE.BoxGeometry(0.6 * s, 0.02 * s, 0.3 * s), panelMaterial!);
  panelL.position.set(-0.4 * s, 0, 0);
  group.add(panelL);
  const panelR = new THREE.Mesh(new THREE.BoxGeometry(0.6 * s, 0.02 * s, 0.3 * s), panelMaterial!);
  panelR.position.set(0.4 * s, 0, 0);
  group.add(panelR);
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

export default function SpaceGlobe() {
  const globeRef = useRef<GlobeMethods>();
  const [isLoading, setIsLoading] = useState(true);
  const [showSatellites, setShowSatellites] = useState(true);
  const [showLaunches, setShowLaunches] = useState(true);
  const [showNightSide, setShowNightSide] = useState(true);
  const [satellitePositions, setSatellitePositions] = useState<SatellitePosition[]>([]);
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [selectedSatellite, setSelectedSatellite] = useState<SatellitePosition | null>(null);
  const [selectedLaunches, setSelectedLaunches] = useState<Launch[] | null>(null);
  const [showUpcomingPanel, setShowUpcomingPanel] = useState(false);
  const [selectedGlobeId, setSelectedGlobeId] = useState<string>('earth');
  const [searchQuery, setSearchQuery] = useState('');
  const [orbiterPositions, setOrbiterPositions] = useState<Array<{ id: string; name: string; lat: number; lng: number; alt: number; category: string }>>([]);
  const [nightPolygon, setNightPolygon] = useState<any>(null);
  const [dayNightMaterial, setDayNightMaterial] = useState<THREE.ShaderMaterial | null>(null);
  const sunPosRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const [globeReady, setGlobeReady] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const dataLoadedRef = useRef(false);

  useEffect(() => {
    const update = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    if (dataLoadedRef.current) return;
    dataLoadedRef.current = true;

    async function loadData() {
      try {
        const [satData, launchData] = await Promise.all([
          fetchSatelliteData(),
          fetchLaunches(),
        ]);

        if (satData?.length > 0) {
          parseSatelliteData(satData);
          const positions = propagatePositions(new Date());
          setSatellitePositions(positions);
        }

        const validLaunches = (launchData || []).filter(
          (l: Launch) => l.lat != null && l.lng != null
        );
        setLaunches(validLaunches);
      } catch (err) {
        console.error('Globe data load error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    if (!showSatellites) return;

    let rafId: number;
    let lastPropTime = 0;
    const PROP_INTERVAL = 1000; // recompute SGP4 every 1s
    const INTERP_STEP = 50; // interpolate position every 50ms for smooth movement

    let prevPositions: SatellitePosition[] = [];
    let nextPositions: SatellitePosition[] = [];
    let interpStart = Date.now();

    const propagate = () => {
      prevPositions = nextPositions.length > 0 ? nextPositions : propagatePositions(new Date());
      nextPositions = propagatePositions(new Date(Date.now() + PROP_INTERVAL));
      interpStart = Date.now();
    };
    propagate();
    setSatellitePositions(prevPositions);

    const tick = () => {
      const now = Date.now();
      if (now - lastPropTime >= PROP_INTERVAL) {
        lastPropTime = now;
        propagate();
      }
      const t = Math.min((now - interpStart) / PROP_INTERVAL, 1);
      if (prevPositions.length === nextPositions.length && prevPositions.length > 0) {
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
  }, [showSatellites]);

  useEffect(() => {
    if (selectedGlobeId !== 'moon' && selectedGlobeId !== 'mars') {
      setOrbiterPositions([]);
      return;
    }
    const tick = () => {
      const now = new Date();
      setOrbiterPositions(selectedGlobeId === 'moon' ? getMoonOrbiters(now) : getMarsOrbiters(now));
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [selectedGlobeId]);

  useEffect(() => {
    if (!showNightSide || selectedGlobeId !== 'earth') {
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
      dayTex.anisotropy = 16;
      nightTex.anisotropy = 16;
      setDayNightMaterial(mat);
    }).catch(() => {
      setNightPolygon(generateNightPolygon(new Date()));
      fallbackInterval = setInterval(() => setNightPolygon(generateNightPolygon(new Date())), 60000);
    });
    return () => { if (fallbackInterval) clearInterval(fallbackInterval); };
  }, [showNightSide, selectedGlobeId]);

  useEffect(() => {
    if (!dayNightMaterial || !showNightSide) return;
    const updateSun = () => {
      const [lng, lat] = getSubsolarPoint(new Date());
      dayNightMaterial.uniforms.sunPosition.value.set(lng, lat);
    };
    updateSun();
    const sunInterval = setInterval(updateSun, 30000);
    return () => clearInterval(sunInterval);
  }, [dayNightMaterial, showNightSide]);

  const handleZoom = useCallback(
    (pov: { lat: number; lng: number; altitude: number }) => {
      if (dayNightMaterial) {
        dayNightMaterial.uniforms.globeRotation.value.set(pov.lng, pov.lat);
      }
    },
    [dayNightMaterial]
  );

  // Orbit path for selected satellite only (shown when clicking a satellite)
  const selectedOrbitPath = useMemo(() => {
    if (!selectedSatellite) return null;
    return computeOrbitPath(selectedSatellite.noradId, selectedSatellite.period || 90, 180);
  }, [selectedSatellite]);

  const handleGlobeReady = useCallback(() => {
    setTimeout(() => {
      const globe = globeRef.current;
      if (!globe || typeof globe.pointOfView !== 'function') return;

      globe.pointOfView({ lat: 28, lng: -38, altitude: 2.5 }, 0);

      if (dayNightMaterial) {
        dayNightMaterial.uniforms.globeRotation.value.set(-38, 28);
      }

      try {
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
  }, [dayNightMaterial]);

  const handleSatelliteClick = useCallback(
    (point: object) => {
      const sat = point as SatellitePosition;
      setSelectedSatellite(sat);
      setSelectedLaunches(null);
      setShowUpcomingPanel(true);
    },
    []
  );

  const handleLaunchClick = useCallback(
    (point: object) => {
      const loc = point as { lat: number; lng: number; launches: Launch[] };
      setSelectedLaunches(loc?.launches || null);
      setSelectedSatellite(null);
      setShowUpcomingPanel(true);
    },
    []
  );

  const handleClosePanel = useCallback(() => {
    setSelectedSatellite(null);
    setSelectedLaunches(null);
    setShowUpcomingPanel(false);
  }, []);

  const searchResults = useMemo(
    () => (searchQuery.trim().length >= 2 ? searchSatellites(searchQuery) : []),
    [searchQuery]
  );

  const handleSearchSelect = useCallback(
    (noradId: number) => {
      const sat = satellitePositions.find((s) => s.noradId === noradId);
      if (sat) {
        setSelectedSatellite(sat);
        setSelectedLaunches(null);
        setShowUpcomingPanel(true);
        setSearchQuery('');
        if (selectedGlobeId !== 'earth') setSelectedGlobeId('earth');
        const globe = globeRef.current;
        if (globe && typeof globe.pointOfView === 'function') {
          globe.pointOfView({ lat: sat.lat, lng: sat.lng, altitude: 2 }, 800);
        }
      }
    },
    [satellitePositions, selectedGlobeId]
  );

  const satPointsData = useMemo(() => {
    if (!showSatellites) return [];
    return satellitePositions;
  }, [showSatellites, satellitePositions]);

  const orbiterPointsData = useMemo(() => {
    if (selectedGlobeId !== 'moon' && selectedGlobeId !== 'mars') return [];
    return orbiterPositions;
  }, [selectedGlobeId, orbiterPositions]);

  const launchPointsData = useMemo(() => {
    if (!showLaunches || launches.length === 0) return [];
    const key = (l: Launch) => `${(l.lat ?? 0).toFixed(2)}_${(l.lng ?? 0).toFixed(2)}`;
    const byLoc = new Map<string, Launch[]>();
    for (const l of launches) {
      if (l.lat == null || l.lng == null) continue;
      const k = key(l);
      if (!byLoc.has(k)) byLoc.set(k, []);
      byLoc.get(k)!.push(l);
    }
    return Array.from(byLoc.entries()).map(([_, launchList]) => ({
      lat: launchList[0].lat!,
      lng: launchList[0].lng!,
      launches: launchList,
      locationName: launchList[0].padLocation || launchList[0].padName || 'Launch site',
    }));
  }, [showLaunches, launches]);

  const upcomingLaunches = useMemo(() => {
    const now = Date.now();
    return [...launches]
      .filter((l) => {
        const ts = Date.parse(l.net);
        return Number.isFinite(ts) && ts >= now;
      })
      .sort((a, b) => Date.parse(a.net) - Date.parse(b.net))
      .slice(0, 16);
  }, [launches]);

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
  const showOrbiterPanel = selectedGlobeId === 'moon' || selectedGlobeId === 'mars';;

  if (dimensions.width === 0) return null;

  return (
    <>
      <header className={styles.topNav}>
        <div className={styles.topNavInner}>
          <div className={styles.logo}>
            <img src="/logo-proxima.png" alt="PROXIMA" />
          </div>
          <nav className={styles.globeNav}>
            {GLOBE_CONFIGS.map((g) => (
              <button
                key={g.id}
                type="button"
                className={selectedGlobeId === g.id ? styles.globeNavBtnActive : styles.globeNavBtn}
                onClick={() => setSelectedGlobeId(g.id)}
              >
                {g.label}
              </button>
            ))}
          </nav>
          <div className={styles.navRight}>
            <div className={styles.searchInputWrap}>
              <span className={styles.searchIcon} aria-hidden>⌕</span>
              <input
                type="search"
                className={styles.searchInput}
                placeholder="Search satellites..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search satellites"
              />
            </div>
            <button
              className={styles.navUpcomingBtn}
              type="button"
              onClick={() => {
                setSelectedSatellite(null);
                setSelectedLaunches(null);
                setShowUpcomingPanel(true);
              }}
            >
              Upcoming
            </button>
          </div>
        </div>
      </header>

      {isLoading && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>Loading orbital data...</p>
        </div>
      )}

      <div className={styles.globeWrap}>
        <GlobeGL
          key={selectedGlobeId}
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl={useDayNight && dayNightMaterial ? null : defaultGlobeUrl}
          globeMaterial={useDayNight && dayNightMaterial ? dayNightMaterial : undefined}
          bumpImageUrl={useDayNight && dayNightMaterial ? undefined : (bumpImageUrl || undefined)}
          showAtmosphere={true}
          atmosphereColor="#1d9bf0"
          atmosphereAltitude={0.15}
          onGlobeReady={handleGlobeReady}
          onZoom={handleZoom}
          // Satellites / orbiters: 3D objects in orbit
          objectsData={showEarthData ? satPointsData : orbiterPointsData}
          objectLat="lat"
          objectLng="lng"
          objectAltitude={(d: any) => {
            if (selectedGlobeId === 'moon') return Math.max((d.alt || 50) / MOON_RADIUS_KM, 0.02);
            if (selectedGlobeId === 'mars') return Math.max((d.alt || 300) / MARS_RADIUS_KM, 0.02);
            return Math.max((d.alt || 400) / EARTH_RADIUS_KM, 0.02);
          }}
          objectThreeObject={showEarthData ? createSatObject : createOrbiterObject}
          objectLabel={() => ''}
          onObjectClick={showEarthData ? handleSatelliteClick : undefined}
          // Launch points: one green point per location, click shows all upcoming launches
          pointsData={showEarthData ? launchPointsData : []}
          pointLat="lat"
          pointLng="lng"
          pointColor={() => '#00c853'}
          pointAltitude={0.01}
          pointRadius={0.5}
          pointLabel={() => ''}
          onPointClick={(p: object) => handleLaunchClick(p)}
          // Night side overlay
          polygonsData={showEarthData ? nightPolygonsData : []}
          polygonCapColor={() => 'rgba(0, 0, 20, 0.5)'}
          polygonSideColor={() => 'rgba(0, 0, 0, 0)'}
          polygonStrokeColor={() => 'rgba(0, 0, 0, 0)'}
          polygonAltitude={0.005}
          // Orbit paths: solid line, no animation
          pathsData={showEarthData ? pathsData : []}
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
        showSatellites={showSatellites}
        setShowSatellites={setShowSatellites}
        showLaunches={showLaunches}
        setShowLaunches={setShowLaunches}
        showNightSide={showNightSide}
        setShowNightSide={setShowNightSide}
        satelliteCount={showEarthData ? getSatelliteCount() : orbiterPositions.length}
        launchSiteCount={showEarthData ? launchPointsData.length : 0}
        mode={showOrbiterPanel ? 'orbiter' : 'earth'}
      />

      <SearchResultsPanel
        query={searchQuery}
        results={searchResults}
        onSelect={handleSearchSelect}
        onClose={() => setSearchQuery('')}
      />

      <InfoPanel
        satellite={selectedSatellite}
        launches={selectedLaunches}
        upcomingLaunches={upcomingLaunches}
        showUpcomingPanel={showUpcomingPanel}
        onClose={handleClosePanel}
        onExpandUpcoming={() => setShowUpcomingPanel(true)}
      />
    </>
  );
}
