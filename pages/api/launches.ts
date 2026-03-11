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
      'https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=50&ordering=net&mode=detailed',
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

    const launches = results.map((l: any) => {
      const rawVidUrls = l.mission?.vid_urls || l.vid_urls || [];
      const seen = new Set<string>();
      const vidUrls = rawVidUrls
        .map((v: any) => {
          const url = typeof v === 'string' ? v : (v?.url || '');
          if (!url || seen.has(url)) return null;
          seen.add(url);
          const title = typeof v === 'object' && v?.title ? v.title : (v?.type?.name || null);
          const source = typeof v === 'object' && v?.source ? String(v.source).toLowerCase() : '';
          const isLive = typeof v === 'object' && v?.live === true;
          const label = title || (isLive ? 'Livestream' : (source.includes('youtube') ? 'YouTube' : 'Video'));
          return { url, title: label, source, isLive };
        })
        .filter(Boolean) as { url: string; title: string; source?: string; isLive?: boolean }[];
      const webcastUrl = typeof l.webcast_live === 'string' ? l.webcast_live : null;
      if (webcastUrl && !vidUrls.some((v) => v.url === webcastUrl)) {
        vidUrls.unshift({ url: webcastUrl, title: 'Livestream', isLive: true });
      }
      const rawLinks = [
        ...(Array.isArray(l.info_urls) ? l.info_urls : []),
        ...(Array.isArray(l.mission?.info_urls) ? l.mission.info_urls : []),
        l.mission?.wiki_url || null,
        l.rocket?.configuration?.wiki_url || null,
      ];
      const isApiUrl = (u: string) => /thespacedevs\.com|lldev\.thespacedevs\.com/i.test(u);
      const linkSeen = new Set<string>();
      const externalLinks = rawLinks
        .map((x: any) => {
          const url = typeof x === 'string' ? x : (x?.url || '');
          const title = typeof x === 'object' && x?.title ? x.title : '';
          if (!url || linkSeen.has(url) || isApiUrl(url)) return null;
          linkSeen.add(url);
          return {
            url,
            title: title || (url.includes('wikipedia') ? 'Wikipedia' : 'Mission link'),
          };
        })
        .filter(Boolean) as { url: string; title: string }[];
      const lsp = l.launch_service_provider;
      const providerUrlRaw = typeof lsp?.info_url === 'string' ? lsp.info_url : (typeof lsp?.url === 'string' ? lsp.url : undefined);
      const providerUrl = providerUrlRaw && !isApiUrl(providerUrlRaw) ? providerUrlRaw : undefined;
      if (providerUrl && !externalLinks.some((x) => x.url === providerUrl) && !/spacex\.com|x\.com\/spacex/i.test(providerUrl)) {
        externalLinks.unshift({
          url: providerUrl,
          title: `${lsp?.name || 'Provider'} website`,
        });
      }
      return {
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
        providerUrl,
        lat: l.pad?.latitude ? parseFloat(l.pad.latitude) : null,
        lng: l.pad?.longitude ? parseFloat(l.pad.longitude) : null,
        image: l.image?.image_url || l.image || null,
        vidUrls,
        externalLinks,
      };
    });

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
