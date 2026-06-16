export const dynamic = 'force-dynamic';

// Tạm thời fallback về ảnh Google Drive (qua proxy /photo) khi chưa cấu hình Supabase.
const DRIVE_FALLBACK = [
  { url: '/photo?id=1Fqi0zOLVGN9fzMg9YtY2pOC3u7q-WyfN', title: 'IMG_4116' },
  { url: '/photo?id=1wYj-b5adY_woFDeDqwGdPBJDAT6hdVNV', title: 'IMG_2465' },
];

const IMG_RE = /\.(jpe?g|png|webp|gif|avif)$/i;

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
        const photos = (Array.isArray(items) ? items : [])
          .filter((it: any) => it && it.name && IMG_RE.test(it.name))
          .map((it: any) => ({
            url: `${base}/storage/v1/object/public/${bucket}/${encodeURIComponent(it.name)}`,
            title: it.name,
          }));
        if (photos.length) {
          return Response.json(photos, {
            headers: { 'Cache-Control': 'public, max-age=60' },
          });
        }
      }
    } catch {
      // rơi xuống fallback
    }
  }

  return Response.json(DRIVE_FALLBACK);
}
