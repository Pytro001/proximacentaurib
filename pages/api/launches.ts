import type { NextApiRequest, NextApiResponse } from 'next';

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
let cache: CacheEntry | null = null;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return res.status(200).json(cache.data);
  }

  try {
    let response = await fetch(
      'https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=20&ordering=net',
      { headers: { Accept: 'application/json' } }
    );

    if (!response.ok) {
      response = await fetch(
        'https://ll.thespacedevs.com/2.3.0/launches/?limit=30&ordering=net',
        { headers: { Accept: 'application/json' } }
      );
    }

    if (!response.ok) {
      throw new Error(`Launch Library responded with ${response.status}`);
    }

    const raw = await response.json();
    let results = raw.results || [];
    const isUpcoming = response.url.includes('upcoming');
    if (!isUpcoming) {
      const now = new Date().toISOString();
      results = results.filter((l: any) => l.net && l.net >= now);
    }

    const launches = results.map((l: any) => ({
      id: l.id,
      name: l.name,
      status: l.status?.name || 'Unknown',
      net: l.net,
      windowStart: l.window_start,
      windowEnd: l.window_end,
      provider: l.launch_service_provider?.name || 'Unknown',
      rocket: l.rocket?.configuration?.name || 'Unknown',
      mission: l.mission?.name || l.name,
      missionDescription: l.mission?.description || '',
      orbitName: l.mission?.orbit?.name || '',
      padName: l.pad?.name || 'Unknown',
      padLocation: l.pad?.location?.name || '',
      lat: l.pad?.latitude ? parseFloat(l.pad.latitude) : null,
      lng: l.pad?.longitude ? parseFloat(l.pad.longitude) : null,
      image: l.image || null,
    }));

    cache = { data: launches, timestamp: Date.now() };

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate');
    return res.status(200).json(launches);
  } catch (error) {
    console.error('Launches API error:', error);
    if (cache) {
      return res.status(200).json(cache.data);
    }
    return res.status(500).json({ error: 'Failed to fetch launch data' });
  }
}
