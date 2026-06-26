'use client';

import { useRef, useState } from 'react';

// Trang upload gọn nhẹ: nhập mật khẩu, chọn ảnh/video, đẩy lên Supabase bucket.
// Tự đổi HEIC/HEIF (ảnh iPhone) -> JPEG ngay trong trình duyệt trước khi gửi.
// Gửi tới route /album/upload (server dùng service key, chạy kể cả khi bucket private).

type Row = { name: string; status: 'pending' | 'ok' | 'error'; msg?: string };

async function toUploadable(file: File): Promise<File> {
  const isHeic =
    /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
  if (!isHeic) return file;
  // nạp heic2any từ CDN chỉ khi cần
  const w = window as any;
  if (!w.heic2any) {
    await new Promise<void>((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
      s.onload = () => res();
      s.onerror = () => rej(new Error('Không nạp được bộ chuyển HEIC'));
      document.body.appendChild(s);
    });
  }
  const blob: Blob = await w.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
  const base = file.name.replace(/\.(heic|heif)$/i, '');
  return new File([blob], base + '.jpg', { type: 'image/jpeg' });
}

export default function Home() {
  const [passcode, setPasscode] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function setRow(name: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.name === name ? { ...r, ...patch } : r)));
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    if (!passcode) {
      alert('Nhập mật khẩu trước đã.');
      return;
    }
    const list = Array.from(files);
    setRows(list.map((f) => ({ name: f.name, status: 'pending' as const })));
    setBusy(true);
    for (const f of list) {
      try {
        const up = await toUploadable(f);
        const form = new FormData();
        form.append('passcode', passcode);
        form.append('file', up);
        const r = await fetch('/album/upload', { method: 'POST', body: form });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.ok) setRow(f.name, { status: 'ok', msg: j.name });
        else setRow(f.name, { status: 'error', msg: j.error || ('Lỗi ' + r.status) });
      } catch (e: any) {
        setRow(f.name, { status: 'error', msg: e?.message || 'Lỗi' });
      }
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  const okCount = rows.filter((r) => r.status === 'ok').length;

  return (
    <main
      style={{
        minHeight: '100vh',
        margin: 0,
        background: 'radial-gradient(1000px circle at 50% -10%, #1e293b, #0b0f17 60%)',
        color: '#e8edf5',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          width: 'min(440px, 94vw)',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 18,
          padding: 26,
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>Tải ảnh / video lên album</h1>
        <p style={{ color: '#9aa6b8', fontSize: 13, lineHeight: 1.5, margin: '0 0 18px' }}>
          Nhập mật khẩu rồi chọn tệp. Ảnh iPhone (HEIC) sẽ tự đổi sang JPEG. Tối đa 50MB mỗi tệp.
        </p>

        <input
          type="password"
          placeholder="Mật khẩu upload"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          style={{
            width: '100%',
            padding: '11px 13px',
            fontSize: 14,
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.16)',
            background: 'rgba(255,255,255,0.06)',
            color: '#fff',
            outline: 'none',
            marginBottom: 12,
            boxSizing: 'border-box',
          }}
        />

        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*,.heic,.heif"
          disabled={busy}
          onChange={(e) => handleFiles(e.target.files)}
          style={{ display: 'none' }}
          id="filepick"
        />
        <label
          htmlFor="filepick"
          style={{
            display: 'block',
            textAlign: 'center',
            padding: '12px',
            borderRadius: 10,
            background: busy ? '#334155' : '#6366f1',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          {busy ? 'Đang tải lên…' : '＋ Chọn ảnh / video'}
        </label>

        {rows.length > 0 && (
          <div style={{ marginTop: 16, fontSize: 13 }}>
            {okCount > 0 && (
              <div style={{ color: '#7fe6c8', marginBottom: 8 }}>Đã lên: {okCount}/{rows.length}</div>
            )}
            {rows.map((r) => (
              <div
                key={r.name}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '6px 0',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.name}
                </span>
                <span
                  style={{
                    flexShrink: 0,
                    color: r.status === 'ok' ? '#7fe6c8' : r.status === 'error' ? '#ff9a8a' : '#9aa6b8',
                  }}
                  title={r.msg}
                >
                  {r.status === 'ok' ? '✓' : r.status === 'error' ? '✕ ' + (r.msg || '') : '…'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p style={{ color: '#64748b', fontSize: 11, marginTop: 16 }}>
        Vũ Đức An · upload riêng tư
      </p>
    </main>
  );
}
