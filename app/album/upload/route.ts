import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

// Nhận ảnh từ trang, kiểm tra mật khẩu, rồi upload lên Supabase Storage
// bằng service key (chỉ ở phía server). Người lạ không có mật khẩu -> không upload được.
export async function POST(req: NextRequest) {
  const base = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const passcode = process.env.UPLOAD_PASSCODE;
  const bucket = process.env.SUPABASE_BUCKET || 'album';

  if (!base || !serviceKey || !passcode) {
    return Response.json({ error: 'Server chưa cấu hình upload (thiếu env).' }, { status: 500 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: 'Dữ liệu không hợp lệ.' }, { status: 400 });
  }

  const pass = form.get('passcode');
  if (typeof pass !== 'string' || pass !== passcode) {
    return Response.json({ error: 'Sai mật khẩu.' }, { status: 401 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return Response.json({ error: 'Thiếu file.' }, { status: 400 });
  }
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  if (!isImage && !isVideo) {
    return Response.json({ error: 'Chỉ chấp nhận ảnh hoặc video.' }, { status: 400 });
  }
  if (file.size === 0) {
    return Response.json({ error: 'File rỗng, hãy chọn lại tệp khác.' }, { status: 400 });
  }
  if (file.size > 50 * 1024 * 1024) {
    return Response.json({ error: 'Tệp quá lớn (tối đa 50MB).' }, { status: 400 });
  }

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (isVideo && !['mp4', 'webm', 'm4v', 'ogv'].includes(ext)) {
    return Response.json({ error: 'Video nên là MP4/WebM/M4V để chạy ổn trên trình duyệt.' }, { status: 400 });
  }
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext || 'jpg'}`;
  const buf = await file.arrayBuffer();

  const r = await fetch(`${base}/storage/v1/object/${bucket}/${safeName}`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': file.type,
      'x-upsert': 'true',
    },
    body: buf,
  });

  if (!r.ok) {
    const t = await r.text().catch(() => '');
    return Response.json({ error: 'Upload thất bại: ' + t.slice(0, 200) }, { status: 500 });
  }

  return Response.json({ ok: true, name: safeName });
}
