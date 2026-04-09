/** YouTube video id from common URL shapes, or null. */
export function youtubeVideoId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0];
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      const embed = u.pathname.match(/^\/embed\/([^/?]+)/);
      if (embed?.[1]) return embed[1];
      const shorts = u.pathname.match(/^\/shorts\/([^/?]+)/);
      if (shorts?.[1]) return shorts[1];
    }
  } catch {
    /* invalid URL */
  }
  return null;
}

export function youtubeThumbnailUrl(videoId: string, size: 'default' | 'mq' | 'hq' = 'mq'): string {
  const s = size === 'hq' ? 'hqdefault' : size === 'mq' ? 'mqdefault' : 'default';
  return `https://i.ytimg.com/vi/${videoId}/${s}.jpg`;
}

export function isXPostUrl(url: string): boolean {
  if (!url) return false;
  return /^(https?:\/\/)?([^/]+\.)?(x\.com|twitter\.com)\//i.test(url.trim());
}

export type VideoPreviewKind = 'youtube' | 'x' | 'other';

export function videoPreviewKind(url: string): VideoPreviewKind {
  if (youtubeVideoId(url)) return 'youtube';
  if (isXPostUrl(url)) return 'x';
  return 'other';
}
