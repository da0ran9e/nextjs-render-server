import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const MUSIC_PATH = '_settings/music.json';

type StoredMusic = {
  updatedAt?: string;
  youtubeId?: string;
  youtubeUrl?: string;
};

function storagePath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/');
}

function objectUrl(base: string, bucket: string, path: string) {
  return `${base}/storage/v1/object/${bucket}/${storagePath(path)}`;
}

function parseYoutubeId(raw: string) {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  let id = '';

  if (host === 'youtu.be') {
    id = url.pathname.split('/').filter(Boolean)[0] || '';
  } else if (
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host === 'youtube-nocookie.com'
  ) {
    id = url.searchParams.get('v') || '';
    if (!id) {
      const parts = url.pathname.split('/').filter(Boolean);
      if (['embed', 'shorts', 'live'].includes(parts[0])) id = parts[1] || '';
    }
  }

  return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
}

function publicMusic(data: StoredMusic | null) {
  if (!data?.youtubeId || !data.youtubeUrl) return null;
  return {
    embedUrl: `https://www.youtube-nocookie.com/embed/${data.youtubeId}`,
    updatedAt: data.updatedAt || null,
    youtubeId: data.youtubeId,
    youtubeUrl: data.youtubeUrl,
  };
}

export async function GET() {
  const base = process.env.SUPABASE_URL;
  const bucket = process.env.SUPABASE_BUCKET || 'album';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!base || !key) return Response.json({ music: null });

  try {
    const r = await fetch(objectUrl(base, bucket, MUSIC_PATH), {
      cache: 'no-store',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      },
    });
    if (!r.ok) return Response.json({ music: null });
    const data = (await r.json()) as StoredMusic;
    return Response.json(
      { music: publicMusic(data) },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return Response.json({ music: null });
  }
}

export async function POST(req: NextRequest) {
  const base = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const passcode = process.env.UPLOAD_PASSCODE;
  const bucket = process.env.SUPABASE_BUCKET || 'album';

  if (!base || !serviceKey || !passcode) {
    return Response.json({ error: 'Server chưa cấu hình lưu nhạc (thiếu env).' }, { status: 500 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Dữ liệu không hợp lệ.' }, { status: 400 });
  }

  if (body?.passcode !== passcode) {
    return Response.json({ error: 'Sai mật khẩu.' }, { status: 401 });
  }

  const youtubeUrl = typeof body?.youtubeUrl === 'string' ? body.youtubeUrl.trim() : '';
  const youtubeId = parseYoutubeId(youtubeUrl);
  if (!youtubeId) {
    return Response.json({ error: 'Link YouTube không hợp lệ.' }, { status: 400 });
  }

  const data: StoredMusic = {
    updatedAt: new Date().toISOString(),
    youtubeId,
    youtubeUrl,
  };

  const r = await fetch(objectUrl(base, bucket, MUSIC_PATH), {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      'x-upsert': 'true',
    },
    body: JSON.stringify(data),
  });

  if (!r.ok) {
    const t = await r.text().catch(() => '');
    return Response.json({ error: 'Lưu nhạc thất bại: ' + t.slice(0, 200) }, { status: 500 });
  }

  return Response.json({ music: publicMusic(data), ok: true });
}
