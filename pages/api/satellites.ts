import type { NextApiRequest, NextApiResponse } from 'next';

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
let cache: CacheEntry | null = null;

const CELESTRAK_GROUPS = [
  'stations',
  'visual',
  'weather',
  'resource',
  'sarsat',
  'geo',
  'gpz',
  'gps-ops',
  'galileo',
  'starlink',
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const group = (req.query.group as string) || 'visual';

  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return res.status(200).json(cache.data);
  }

  try {
    const validGroup = CELESTRAK_GROUPS.includes(group) ? group : 'visual';
    const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${validGroup}&FORMAT=json`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`CelesTrak responded with ${response.status}`);
    }

    const data = await response.json();

    cache = { data, timestamp: Date.now() };

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json(data);
  } catch (error) {
    console.error('Satellite API error:', error);
    if (cache) {
      return res.status(200).json(cache.data);
    }
    return res.status(500).json({ error: 'Failed to fetch satellite data' });
  }
}
