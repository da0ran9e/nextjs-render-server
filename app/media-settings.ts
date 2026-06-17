export type MediaKind = 'image' | 'video';

export const IMG_RE = /\.(jpe?g|png|webp|gif|avif|bmp)$/i;
export const VID_RE = /\.(mp4|webm|mov|m4v|ogv)$/i;

function envInt(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name];
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function cleanPrefix(raw: string) {
  return raw.replace(/^\/+|\/+$/g, '').replace(/[^\w./-]/g, '') || '_render';
}

export function mediaSettings() {
  const imageMaxEdge = envInt('ALBUM_RENDER_IMAGE_MAX_EDGE', 1600, 320, 4096);
  const imageQuality = envInt('ALBUM_RENDER_IMAGE_QUALITY', 72, 35, 95);
  const videoMaxWidth = envInt('ALBUM_RENDER_VIDEO_MAX_WIDTH', 960, 240, 1920);
  const videoCrf = envInt('ALBUM_RENDER_VIDEO_CRF', 30, 18, 40);
  const videoTimeoutMs = envInt('ALBUM_RENDER_VIDEO_TIMEOUT_MS', 120000, 15000, 600000);
  const cachePrefix = cleanPrefix(process.env.ALBUM_RENDER_CACHE_PREFIX || '_render');
  const videoPreset = process.env.ALBUM_RENDER_VIDEO_PRESET || 'veryfast';

  return {
    cachePrefix,
    imageMaxEdge,
    imageProfile: `img-w${imageMaxEdge}-q${imageQuality}-webp`,
    imageQuality,
    videoCrf,
    videoMaxWidth,
    videoPreset,
    videoProfile: `video-w${videoMaxWidth}-crf${videoCrf}-mp4`,
    videoTimeoutMs,
  };
}

export function mediaKind(name: string): MediaKind | null {
  if (IMG_RE.test(name)) return 'image';
  if (VID_RE.test(name)) return 'video';
  return null;
}

export function mediaUrl(name: string) {
  const kind = mediaKind(name);
  const settings = mediaSettings();
  const profile = kind === 'video' ? settings.videoProfile : settings.imageProfile;
  return `/media?name=${encodeURIComponent(name)}&v=${encodeURIComponent(profile)}`;
}
