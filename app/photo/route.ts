import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

// Proxy ảnh công khai từ Google Drive về cùng nguồn (same-origin),
// để Three.js dùng làm texture không bị lỗi CORS. Ảnh được Google
// thu nhỏ sẵn (sz=w1600) nên tải nhẹ.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return new Response('invalid id', { status: 400 });
  }

  const candidates = [
    `https://drive.google.com/thumbnail?id=${id}&sz=w1600`,
    `https://drive.google.com/uc?export=view&id=${id}`,
  ];

  for (const url of candidates) {
    try {
      const r = await fetch(url, { redirect: 'follow' });
      const type = r.headers.get('content-type') || '';
      if (r.ok && type.startsWith('image/')) {
        const buf = await r.arrayBuffer();
        return new Response(buf, {
          headers: {
            'Content-Type': type,
            'Cache-Control': 'public, max-age=86400, s-maxage=86400',
          },
        });
      }
    } catch {
      // thử ứng viên tiếp theo
    }
  }

  return new Response('not found or not public', { status: 404 });
}
