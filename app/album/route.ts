export const dynamic = 'force-dynamic';

// Fallback khi chưa cấu hình Supabase
const FALLBACK = [
  { url: '/photo?id=1Fqi0zOLVGN9fzMg9YtY2pOC3u7q-WyfN', title: 'IMG_4116', type: 'image' },
  { url: '/photo?id=1wYj-b5adY_woFDeDqwGdPBJDAT6hdVNV', title: 'IMG_2465', type: 'image' },
];

const IMG_RE = /\.(jpe?g|png|webp|gif|avif|bmp)$/i;
const VID_RE = /\.(mp4|webm|mov|m4v|ogv)$/i;

export async function GET() {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  const bucket = process.env.SUPABASE_BUCKET || 'album';

  if (base && key) {
    try {
      const r = await fetch(`${base}/storage/v1/object/list/${bucket}`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prefix: '',
          limit: 300,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' },
        }),
      });
      if (r.ok) {
        const items = await r.json();
        const out = (Array.isArray(items) ? items : [])
          .filter((it: any) => it && it.name && (IMG_RE.test(it.name) || VID_RE.test(it.name)))
          .map((it: any) => ({
            url: `${base}/storage/v1/object/public/${bucket}/${encodeURIComponent(it.name)}`,
            title: it.name,
            type: VID_RE.test(it.name) ? 'video' : 'image',
          }));
        if (out.length) {
          return Response.json(out, { headers: { 'Cache-Control': 'public, max-age=60' } });
        }
      }
    } catch {
      // fallback
    }
  }

  return Response.json(FALLBACK);
}
