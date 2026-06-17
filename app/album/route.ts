import { mediaKind, mediaSettings, mediaUrl } from '../media-settings';

export const dynamic = 'force-dynamic';

// Fallback khi chưa cấu hình Supabase
const FALLBACK = [
  { url: '/photo?id=1Fqi0zOLVGN9fzMg9YtY2pOC3u7q-WyfN', title: 'IMG_4116', type: 'image' },
  { url: '/photo?id=1wYj-b5adY_woFDeDqwGdPBJDAT6hdVNV', title: 'IMG_2465', type: 'image' },
];

export async function GET() {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  const bucket = process.env.SUPABASE_BUCKET || 'album';
  const settings = mediaSettings();

  if (base && key) {
    try {
      const pageSize = 1000;
      const items: any[] = [];
      for (let offset = 0; ; offset += pageSize) {
        const r = await fetch(`${base}/storage/v1/object/list/${bucket}`, {
          method: 'POST',
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prefix: '',
            limit: pageSize,
            offset,
            sortBy: { column: 'created_at', order: 'desc' },
          }),
        });
        if (!r.ok) break;
        const batch = await r.json();
        if (!Array.isArray(batch) || batch.length === 0) break;
        items.push(...batch);
        if (batch.length < pageSize) break;
      }

      const out = items
        .filter(
          (it: any) =>
            it &&
            it.name &&
            !it.name.startsWith(`${settings.cachePrefix}/`) &&
            mediaKind(it.name) &&
            (!it.metadata || it.metadata.size == null || it.metadata.size > 0)
        )
        .map((it: any) => ({
          url: mediaUrl(it.name),
          title: it.name,
          type: mediaKind(it.name),
        }));
      if (out.length) {
        return Response.json(out, { headers: { 'Cache-Control': 'public, max-age=60' } });
      }
    } catch {
      // fallback
    }
  }

  return Response.json(FALLBACK);
}
