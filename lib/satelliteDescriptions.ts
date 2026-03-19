/**
 * Short 1–2 sentence descriptions for satellites.
 * Sources: Wikipedia, Gunter's Space Page, NASA.
 * Order matters: more specific patterns first.
 */
const DESCRIPTIONS: Array<{ pattern: string | RegExp; desc: string }> = [
  // Space stations
  { pattern: /^ISS\s*\(ZARYA\)/i, desc: 'International Space Station – modular space station for research and habitation in low Earth orbit.' },
  { pattern: /^CSS\s*\(/i, desc: 'Chinese Space Station – modular space station for microgravity research and crew operations.' },
  { pattern: /^TIANGONG|^TIANHE|^WENTIAN|^MENGTIAN/i, desc: 'Chinese Space Station module – space station for research and crew support.' },
  // Reconnaissance / military
  { pattern: /HELIOS\s*1[AB]/i, desc: 'French military photo-reconnaissance satellite; Italy and Spain participated.' },
  { pattern: /HELIOS\s*2/i, desc: 'French military optical reconnaissance satellite with improved resolution.' },
  { pattern: /CERISE/i, desc: 'French military signals intelligence satellite.' },
  { pattern: /LACROSSE|ONYX/i, desc: 'US military radar reconnaissance satellite.' },
  { pattern: /KEYHOLE|KH-|KENNAN/i, desc: 'US optical reconnaissance satellite.' },
  // Astronomy / science
  { pattern: /^HUBBLE|HST/i, desc: 'NASA optical space telescope for deep-space astronomy; launched 1990.' },
  { pattern: /JAMES\s*WEBB|JWST/i, desc: 'NASA infrared space telescope for early universe and exoplanet research.' },
  { pattern: /CHANDRA/i, desc: 'NASA X-ray observatory for high-energy astrophysics.' },
  { pattern: /^OAO\s*2/i, desc: "NASA's first successful stellar observatory; photographed UV light from young stars." },
  { pattern: /OAO\s*3|COPERNICUS/i, desc: 'NASA UV and X-ray telescope; studied stellar spectra and interstellar absorption.' },
  { pattern: /SPITZER/i, desc: 'NASA infrared space telescope for cold and distant objects.' },
  { pattern: /XMM|XMM-NEWTON/i, desc: 'ESA X-ray observatory for high-energy astrophysics.' },
  { pattern: /FERMI|GLAST/i, desc: 'NASA gamma-ray space telescope for high-energy astrophysics.' },
  { pattern: /SWIFT/i, desc: 'NASA gamma-ray burst observatory.' },
  { pattern: /NICER/i, desc: 'NASA X-ray instrument on ISS for neutron star studies.' },
  // Earth observation / ocean
  { pattern: /SEASAT\s*1/i, desc: "First satellite designed for remote sensing of Earth's oceans; measured waves, winds, ice." },
  { pattern: /LANDSAT/i, desc: 'NASA/USGS Earth observation for land use, agriculture, and environmental monitoring.' },
  { pattern: /SENTINEL/i, desc: 'ESA Copernicus Earth observation for environment and security.' },
  { pattern: /TERRA|AQUA/i, desc: 'NASA Earth observation for climate and environmental science.' },
  { pattern: /SUOMI|JPSS/i, desc: 'Polar-orbiting weather and environmental monitoring.' },
  { pattern: /SPOT\s*\d/i, desc: 'French commercial Earth observation satellite.' },
  { pattern: /WORLDVIEW|PLANET/i, desc: 'Commercial Earth observation for high-resolution imagery.' },
  // Ionosphere / upper atmosphere
  { pattern: /^ISIS\s*[12]/i, desc: 'Canadian-American ionospheric research satellite; studied aurora and electron density.' },
  { pattern: /ALOUETTE/i, desc: 'Canadian ionospheric research satellite.' },
  { pattern: /SERT\s*2/i, desc: 'NASA electric propulsion test satellite.' },
  // Weather
  { pattern: /^GOES/i, desc: 'US geostationary weather satellite monitoring Americas.' },
  { pattern: /^NOAA/i, desc: 'US polar-orbiting weather and environmental monitoring.' },
  { pattern: /METEOSAT/i, desc: 'European geostationary weather satellite.' },
  { pattern: /HIMAWARI/i, desc: 'Japanese geostationary weather satellite.' },
  { pattern: /METOP/i, desc: 'European polar-orbiting weather satellite.' },
  // Navigation
  { pattern: /^GPS|NAVSTAR/i, desc: 'US Global Positioning System for navigation and timing.' },
  { pattern: /GALILEO/i, desc: 'European satellite navigation system.' },
  { pattern: /GLONASS/i, desc: 'Russian satellite navigation system.' },
  { pattern: /BEIDOU|COMPASS/i, desc: 'Chinese satellite navigation system.' },
  { pattern: /QZSS/i, desc: 'Japanese regional satellite navigation augmentation system.' },
  // Communications
  { pattern: /STARLINK/i, desc: 'SpaceX broadband internet constellation for global coverage.' },
  { pattern: /ONEWEB/i, desc: 'Low Earth orbit broadband internet constellation.' },
  { pattern: /KUIPER/i, desc: 'Amazon broadband internet constellation.' },
  { pattern: /IRIDIUM/i, desc: 'Mobile voice and data satellite communications network.' },
  { pattern: /ORBCOMM/i, desc: 'Machine-to-machine and IoT satellite communications.' },
  { pattern: /GLOBALSTAR/i, desc: 'Mobile satellite voice and data services.' },
  { pattern: /INTELSAT|SES\s|EUTELSAT|TELESAT|AMOS/i, desc: 'Geostationary communications satellite for TV, data, and broadband.' },
  // Cargo / crew
  { pattern: /PROGRESS/i, desc: 'Russian cargo spacecraft for ISS resupply.' },
  { pattern: /SOYUZ/i, desc: 'Russian crew or cargo spacecraft.' },
  { pattern: /CYGNUS/i, desc: 'Northrop Grumman cargo spacecraft for ISS resupply.' },
  { pattern: /DRAGON|CREW\s*DRAGON/i, desc: 'SpaceX crew or cargo spacecraft for ISS.' },
  { pattern: /TIANZHOU/i, desc: 'Chinese cargo spacecraft for space station resupply.' },
  { pattern: /HTV|KOUNOTORI/i, desc: 'Japanese cargo spacecraft for ISS resupply.' },
  { pattern: /SHENZHOU/i, desc: 'Chinese crew spacecraft.' },
  // Debris / rocket bodies
  { pattern: /\sR\/B\s|Rocket\s*Body|R\/B$/i, desc: 'Spent rocket stage or space debris.' },
  { pattern: /\sDEB\s|DEBRIS/i, desc: 'Space debris or defunct satellite fragment.' },
  // Other known
  { pattern: /ASTEX\s*1/i, desc: 'US Air Force space technology experiment.' },
  { pattern: /ATLAS\s*CENTAUR/i, desc: 'Spent Atlas-Centaur rocket stage.' },
  { pattern: /SL-3\s*R\/B|SL-8\s*R\/B|SL-14\s*R\/B/i, desc: 'Spent Soviet rocket stage.' },
  { pattern: /THOR\s*AGENA/i, desc: 'Spent Thor-Agena rocket stage.' },
];

function matches(name: string, pattern: string | RegExp): boolean {
  if (typeof pattern === 'string') {
    return name.toUpperCase().includes(pattern.toUpperCase());
  }
  return pattern.test(name);
}

export function getSatelliteDescription(name: string, category: string): string {
  const n = name.trim();
  for (const { pattern, desc } of DESCRIPTIONS) {
    if (matches(n, pattern)) return desc;
  }
  // Fallback by category
  const fallbacks: Record<string, string> = {
    Station: 'Crewed space station for research and microgravity experiments.',
    Constellation: 'Broadband internet constellation for global coverage.',
    Navigation: 'Satellite navigation for positioning and timing.',
    Weather: 'Weather monitoring and climate observation.',
    Science: 'Space telescope or scientific observatory.',
    Communications: 'Communications satellite for TV, data, and voice.',
    'Earth Observation': 'Earth observation for land, ocean, or environment.',
    Cargo: 'Cargo spacecraft for space station resupply.',
    Crew: 'Crew spacecraft for astronaut transport.',
    Debris: 'Space debris or defunct object.',
    Military: 'Military or intelligence satellite.',
    Private: 'Commercial satellite from a private operator.',
    Other: 'Satellite or space object.',
  };
  return fallbacks[category] ?? 'Satellite or space object.';
}
