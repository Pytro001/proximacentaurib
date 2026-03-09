import type { NextApiRequest, NextApiResponse } from 'next';

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
let cache: CacheEntry | null = null;
let cacheAll: CacheEntry | null = null;

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

const ALL_GROUPS = ['stations', 'visual', 'starlink', 'gps-ops', 'galileo', 'weather', 'geo'];

async function fetchGroup(group: string): Promise<any[]> {
  const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CelesTrak ${group}: ${res.status}`);
  return res.json();
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const group = (req.query.group as string) || 'visual';

  if (group === 'all') {
    if (cacheAll && Date.now() - cacheAll.timestamp < CACHE_TTL) {
      return res.status(200).json(cacheAll.data);
    }
    try {
      const results = await Promise.allSettled(ALL_GROUPS.map((g) => fetchGroup(g)));
      const byNorad = new Map<number, any>();
      for (const r of results) {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          for (const rec of r.value) {
            const id = typeof rec.NORAD_CAT_ID === 'string'
              ? parseInt(rec.NORAD_CAT_ID, 10)
              : rec.NORAD_CAT_ID;
            if (id && !byNorad.has(id)) byNorad.set(id, rec);
          }
        }
      }
      const data = Array.from(byNorad.values());
      cacheAll = { data, timestamp: Date.now() };
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
      return res.status(200).json(data);
    } catch (error) {
      console.error('Satellite API (all) error:', error);
      if (cacheAll) return res.status(200).json(cacheAll.data);
      return res.status(500).json({ error: 'Failed to fetch satellite data' });
    }
  }

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
