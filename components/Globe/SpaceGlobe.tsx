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
} from '../../lib/satellites';
import {
  Launch,
  fetchLaunches,
  fetchSatelliteData,
  getLaunchStatusColor,
} from '../../lib/launches';
import ControlsPanel from './ControlsPanel';
import InfoPanel from './InfoPanel';
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
    float blendFactor = smoothstep(-0.1, 0.1, intensity);
    gl_FragColor = mix(nightColor, dayColor, blendFactor);
  }
`;

const DAY_URL = '//unpkg.com/three-globe/example/img/earth-day.jpg';
const NIGHT_URL = '//unpkg.com/three-globe/example/img/earth-night.jpg';

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

function createSatObject(d: object): THREE.Group {
  const sat = d as SatellitePosition;
  const group = new THREE.Group();
  const mat = getSatMaterial(sat.category);

  // Main body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), mat);
  group.add(body);

  // Solar panel left
  const panelL = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.05, 0.7),
    panelMaterial!
  );
  panelL.position.set(-1.0, 0, 0);
  group.add(panelL);

  // Solar panel right
  const panelR = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.05, 0.7),
    panelMaterial!
  );
  panelR.position.set(1.0, 0, 0);
  group.add(panelR);

  // Antenna dish (small cone on top)
  const antenna = new THREE.Mesh(
    new THREE.ConeGeometry(0.15, 0.4, 6),
    mat
  );
  antenna.position.set(0, 0.5, 0);
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

export default function SpaceGlobe() {
  const globeRef = useRef<GlobeMethods>();
  const [isLoading, setIsLoading] = useState(true);
  const [showSatellites, setShowSatellites] = useState(true);
  const [showOrbits, setShowOrbits] = useState(false);
  const [showLaunches, setShowLaunches] = useState(true);
  const [showNightSide, setShowNightSide] = useState(true);
  const [satellitePositions, setSatellitePositions] = useState<SatellitePosition[]>([]);
  const [orbitPaths, setOrbitPaths] = useState<SatelliteOrbitPath[]>([]);
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [selectedSatellite, setSelectedSatellite] = useState<SatellitePosition | null>(null);
  const [selectedLaunch, setSelectedLaunch] = useState<Launch | null>(null);
  const [nightPolygon, setNightPolygon] = useState<any>(null);
  const [dayNightMaterial, setDayNightMaterial] = useState<THREE.ShaderMaterial | null>(null);
  const sunPosRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const globeRotRef = useRef<THREE.Vector2>(new THREE.Vector2());
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
        setLaunches(validLaunches.slice(0, 1));
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

    const interval = setInterval(() => {
      const positions = propagatePositions(new Date());
      setSatellitePositions(positions);
    }, 2000);

    return () => clearInterval(interval);
  }, [showSatellites]);

  useEffect(() => {
    if (!showNightSide) {
      setNightPolygon(null);
      setDayNightMaterial(null);
      return;
    }
    const loader = new THREE.TextureLoader();
    let fallbackInterval: ReturnType<typeof setInterval> | undefined;
    Promise.all([
      loader.loadAsync(`https:${DAY_URL}`),
      loader.loadAsync(`https:${NIGHT_URL}`),
    ]).then(([dayTex, nightTex]) => {
      const [lng, lat] = getSubsolarPoint(new Date());
      sunPosRef.current.set(lng, lat);
      globeRotRef.current.set(0, 20);
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          dayTexture: { value: dayTex },
          nightTexture: { value: nightTex },
          sunPosition: { value: sunPosRef.current.clone() },
          globeRotation: { value: globeRotRef.current.clone() },
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
  }, [showNightSide]);

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

  useEffect(() => {
    if (!dayNightMaterial || !showNightSide || !globeRef.current) return;
    let rafId: number;
    const updateGlobeRotation = () => {
      const globe = globeRef.current;
      if (globe && typeof globe.pointOfView === 'function') {
        const pov = globe.pointOfView();
        if (pov && typeof pov.lng === 'number' && typeof pov.lat === 'number') {
          dayNightMaterial.uniforms.globeRotation.value.set(pov.lng, pov.lat);
        }
      }
      rafId = requestAnimationFrame(updateGlobeRotation);
    };
    updateGlobeRotation();
    return () => cancelAnimationFrame(rafId);
  }, [dayNightMaterial, showNightSide]);

  useEffect(() => {
    if (!showOrbits || satellitePositions.length === 0) {
      setOrbitPaths([]);
      return;
    }

    const paths: SatelliteOrbitPath[] = [];
    for (const sat of satellitePositions) {
      const path = computeOrbitPath(sat.noradId, sat.period || 90, 120);
      if (path) paths.push(path);
    }
    setOrbitPaths(paths);
  }, [showOrbits, satellitePositions]);

  const handleGlobeReady = useCallback(() => {
    setTimeout(() => {
      const globe = globeRef.current;
      if (!globe || typeof globe.pointOfView !== 'function') return;

      globe.pointOfView({ lat: 20, lng: 0, altitude: 2.5 }, 0);

      try {
        const controls = globe.controls();
        if (controls) {
          controls.autoRotate = true;
          controls.autoRotateSpeed = 0.3;
          controls.enableDamping = true;
          controls.dampingFactor = 0.1;
          controls.minDistance = 101;
          controls.maxDistance = 1000;
        }
      } catch {
        // controls may not be available yet
      }

      setGlobeReady(true);
    }, 100);
  }, []);

  const handleSatelliteClick = useCallback(
    (point: object) => {
      const sat = point as SatellitePosition;
      setSelectedSatellite(sat);
      setSelectedLaunch(null);
    },
    []
  );

  const handleLaunchClick = useCallback(
    (point: object) => {
      const launch = point as Launch;
      setSelectedLaunch(launch);
      setSelectedSatellite(null);
    },
    []
  );

  const handleClosePanel = useCallback(() => {
    setSelectedSatellite(null);
    setSelectedLaunch(null);
  }, []);

  const satPointsData = useMemo(() => {
    if (!showSatellites) return [];
    return satellitePositions;
  }, [showSatellites, satellitePositions]);

  const launchPointsData = useMemo(() => {
    if (!showLaunches) return [];
    return launches;
  }, [showLaunches, launches]);

  const launchRingsData = useMemo(() => {
    if (!showLaunches) return [];
    return launches.map((l) => ({
      lat: l.lat,
      lng: l.lng,
      maxR: 3,
      propagationSpeed: 2,
      repeatPeriod: 1200,
      color: getLaunchStatusColor(l.status),
    }));
  }, [showLaunches, launches]);

  const nightPolygonsData = useMemo(() => {
    if (!nightPolygon || dayNightMaterial) return [];
    return [nightPolygon];
  }, [nightPolygon, dayNightMaterial]);

  const pathsData = useMemo(() => {
    if (!showOrbits) return [];
    return orbitPaths;
  }, [showOrbits, orbitPaths]);

  const defaultGlobeUrl = '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg';
  const bumpImageUrl = '//unpkg.com/three-globe/example/img/earth-topology.png';

  if (dimensions.width === 0) return null;

  return (
    <>
      {isLoading && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>Loading orbital data...</p>
        </div>
      )}

      <div className={styles.globeWrap}>
        <GlobeGL
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl={dayNightMaterial ? null : defaultGlobeUrl}
          globeMaterial={dayNightMaterial || undefined}
          bumpImageUrl={dayNightMaterial ? null : bumpImageUrl}
          showAtmosphere={true}
          atmosphereColor="#1d9bf0"
          atmosphereAltitude={0.15}
          onGlobeReady={handleGlobeReady}
          // Satellite dots floating at real altitude
          objectsData={satPointsData}
          objectLat="lat"
          objectLng="lng"
          objectAltitude={(d: any) => (d.alt || 400) / EARTH_RADIUS_KM}
          objectThreeObject={createSatObject}
          objectLabel={() => ''}
          onObjectClick={handleSatelliteClick}
          // Launch rings (pulsing)
          ringsData={launchRingsData}
          ringLat="lat"
          ringLng="lng"
          ringMaxRadius="maxR"
          ringPropagationSpeed="propagationSpeed"
          ringRepeatPeriod="repeatPeriod"
          ringColor="color"
          // Launch point (next only, dot only, no labels)
          pointsData={launchPointsData}
          pointLat="lat"
          pointLng="lng"
          pointColor={(d: any) => getLaunchStatusColor(d.status)}
          pointAltitude={0.01}
          pointRadius={0.4}
          pointLabel={() => ''}
          onPointClick={(p: object) => handleLaunchClick(p)}
          // Night side overlay
          polygonsData={nightPolygonsData}
          polygonCapColor={() => 'rgba(0, 0, 20, 0.5)'}
          polygonSideColor={() => 'rgba(0, 0, 0, 0)'}
          polygonStrokeColor={() => 'rgba(0, 0, 0, 0)'}
          polygonAltitude={0.005}
          // Orbit paths (subtle white lines)
          pathsData={pathsData}
          pathPoints="coords"
          pathPointLat="lat"
          pathPointLng="lng"
          pathPointAlt="alt"
          pathColor={() => 'rgba(255, 255, 255, 0.5)'}
          pathStroke={0.6}
          pathDashLength={0.006}
          pathDashGap={0.004}
          pathDashAnimateTime={8000}
          pathTransitionDuration={0}
        />
      </div>

      <ControlsPanel
        showSatellites={showSatellites}
        setShowSatellites={setShowSatellites}
        showOrbits={showOrbits}
        setShowOrbits={setShowOrbits}
        showLaunches={showLaunches}
        setShowLaunches={setShowLaunches}
        showNightSide={showNightSide}
        setShowNightSide={setShowNightSide}
        satelliteCount={getSatelliteCount()}
      />

      <InfoPanel
        satellite={selectedSatellite}
        launch={selectedLaunch}
        onClose={handleClosePanel}
      />
    </>
  );
}
