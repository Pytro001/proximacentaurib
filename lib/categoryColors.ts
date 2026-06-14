/**
 * Shared satellite-category color palette and ordering.
 * Used by the globe (object materials) and the legend / filter panel so the
 * dots on the globe and the chips in the UI always agree.
 */
export const CATEGORY_COLORS: Record<string, string> = {
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

/** Display order for the legend — most "interesting" / human-relevant first. */
export const CATEGORY_ORDER: string[] = [
  'Station',
  'Crew',
  'Cargo',
  'Science',
  'Navigation',
  'Weather',
  'Communications',
  'Earth Observation',
  'Constellation',
  'Military',
  'Private',
  'Other',
  'Debris',
];

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.Other;
}

/** Short, human descriptions of each category for the legend tooltip. */
export const CATEGORY_BLURB: Record<string, string> = {
  Station: 'Crewed space stations (ISS, Tiangong)',
  Crew: 'Crew transport spacecraft',
  Cargo: 'Resupply / cargo spacecraft',
  Science: 'Telescopes and research observatories',
  Navigation: 'GPS, Galileo, GLONASS, BeiDou',
  Weather: 'Weather and climate monitoring',
  Communications: 'TV, data and voice relay',
  'Earth Observation': 'Imaging and remote sensing',
  Constellation: 'Mega-constellations (Starlink, OneWeb)',
  Military: 'Defense and intelligence',
  Private: 'Commercial smallsat operators',
  Other: 'Uncategorized objects',
  Debris: 'Spent stages and fragments',
};
