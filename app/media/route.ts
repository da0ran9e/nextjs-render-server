import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

// Proxy ảnh/video công khai từ Supabase Storage về cùng nguồn (same-origin),
// để Three.js (WebGL) dùng làm texture mà không vướng CORS.
export async function GET(req: NextRequest) {
  const base = process.env.SUPABASE_URL;
  const bucket = process.env.SUPABASE_BUCKET || 'album';
  const name = req.nextUrl.searchParams.get('name');

  if (!base || !name) return new Response('bad request', { status: 400 });
  if (!/^[\w.\- ]+$/.test(name)) return new Response('bad name', { status: 400 });

  const url = `${base}/storage/v1/object/public/${bucket}/${encodeURIComponent(name)}`;
  try {
    const r = await fetch(url);
    if (!r.ok) return new Response('not found', { status: 404 });
    const ct = r.headers.get('content-type') || 'application/octet-stream';
    const buf = await r.arrayBuffer();
    return new Response(buf, {
      headers: {
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return new Response('error', { status: 502 });
  }
}
