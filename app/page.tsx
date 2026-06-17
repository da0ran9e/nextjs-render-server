'use client';

import { useEffect, useRef, useState } from 'react';

type Item = { url: string; title?: string; type?: 'image' | 'video' };

function isHeic(f: File) {
  const n = f.name.toLowerCase();
  return (
    f.type === 'image/heic' ||
    f.type === 'image/heif' ||
    n.endsWith('.heic') ||
    n.endsWith('.heif') ||
    n.endsWith('.pvt')
  );
}

function isBrowserVideo(f: File) {
  const n = f.name.toLowerCase();
  return n.endsWith('.mp4') || n.endsWith('.webm') || n.endsWith('.mov') || n.endsWith('.m4v') || n.endsWith('.ogv');
}

function ensureHeicLib(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).heic2any) return resolve();
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('load heic2any failed'));
    document.body.appendChild(s);
  });
}

async function convertIfNeeded(f: File): Promise<File> {
  if (!isHeic(f)) return f;
  await ensureHeicLib();
  const out = await (window as any).heic2any({ blob: f, toType: 'image/jpeg', quality: 0.85 });
  const blob = Array.isArray(out) ? out[0] : out;
  const base = f.name.replace(/\.[^.]+$/, '') || 'photo';
  return new File([blob], base + '.jpg', { type: 'image/jpeg' });
}

export default function Home() {
  const mountRef = useRef<HTMLDivElement>(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function doUpload() {
    if (!files.length) { setStatus('Hãy chọn ảnh/video.'); return; }
    if (!passcode) { setStatus('Nhập mật khẩu.'); return; }
    setBusy(true);
    let ok = 0;
    const errs: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setStatus(`Đang xử lý ${i + 1}/${files.length}: ${f.name}...`);
      try {
        const prepared = await convertIfNeeded(f);
        if (prepared.type.startsWith('video/') && !isBrowserVideo(prepared)) {
          errs.push(`${f.name}: video nên là MP4/MOV/WebM để chạy ổn trên trình duyệt`);
          continue;
        }
        const fd = new FormData();
        fd.append('file', prepared);
        fd.append('passcode', passcode);
        const r = await fetch('/album/upload', { method: 'POST', body: fd });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { errs.push(`${f.name}: ${j.error || r.status}`); }
        else ok++;
      } catch (e: any) {
        errs.push(`${f.name}: ${e?.message || 'lỗi chuyển đổi'}`);
      }
    }
    if (errs.length) {
      setStatus(`Xong ${ok}/${files.length}. Lỗi: ${errs.slice(0, 3).join(' | ')}`);
      setBusy(false);
      if (ok > 0) setTimeout(() => window.location.reload(), 2500);
    } else {
      setStatus(`Tải lên ${ok} tệp thành công! Đang làm mới...`);
      setTimeout(() => window.location.reload(), 900);
    }
  }

  useEffect(() => {
    const SRC = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    const mount = mountRef.current;
    let frameId = 0;
    let renderer: any = null;
    let onResize: (() => void) | null = null;
    let cleanupPointer: (() => void) | null = null;
    const videoEls: HTMLVideoElement[] = [];
    let cancelled = false;

    function addRing(THREE: any, parent: any, items: Item[], radius: number, H: number, faceInward: boolean) {
      const N = Math.max(items.length, 1);
      items.forEach((item, i) => {
        const a = (i / N) * Math.PI * 2 + (faceInward ? Math.PI / N : 0);
        const frame = new THREE.Mesh(
          new THREE.PlaneGeometry(H * 0.78 + 0.12, H + 0.12),
          new THREE.MeshBasicMaterial({ color: 0x1b2333, side: THREE.DoubleSide })
        );
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(H * 0.78, H),
          new THREE.MeshBasicMaterial({ color: 0x0b0f17, side: THREE.DoubleSide })
        );
        mesh.position.z = 0.01;
        frame.add(mesh);
        frame.position.set(radius * Math.sin(a), 0, radius * Math.cos(a));
        frame.rotation.y = faceInward ? a + Math.PI : a;
        parent.add(frame);

        const setAspect = (aspect: number) => {
          const w = H * (aspect || 0.78);
          mesh.geometry.dispose();
          mesh.geometry = new THREE.PlaneGeometry(w, H);
          (frame.geometry as any).dispose();
          frame.geometry = new THREE.PlaneGeometry(w + 0.12, H + 0.12);
        };

        if (item.type === 'video') {
          const v = document.createElement('video');
          v.src = item.url;
          v.crossOrigin = 'anonymous';
          v.loop = true;
          v.muted = true;
          (v as any).playsInline = true;
          v.setAttribute('playsinline', 'true');
          v.autoplay = true;
          v.play().catch(() => {});
          videoEls.push(v);
          const tex = new THREE.VideoTexture(v);
          tex.minFilter = THREE.LinearFilter;
          tex.magFilter = THREE.LinearFilter;
          (mesh.material as any).color.set(0xffffff);
          (mesh.material as any).map = tex;
          (mesh.material as any).needsUpdate = true;
          v.addEventListener('loadedmetadata', () => {
            if (v.videoWidth > 0) setAspect(v.videoWidth / v.videoHeight);
          });
        } else {
          const loader = new THREE.TextureLoader();
          loader.setCrossOrigin('anonymous');
          loader.load(
            item.url,
            (tex: any) => {
              const img = tex.image;
              const aspect = img && img.width && img.height ? img.width / img.height : 0.78;
              setAspect(aspect);
              (mesh.material as any).color.set(0xffffff);
              (mesh.material as any).map = tex;
              (mesh.material as any).needsUpdate = true;
            },
            undefined,
            () => {}
          );
        }
      });
    }

    function startWithAlbum(all: Item[]) {
      const THREE = (window as any).THREE;
      if (!THREE || !mount || cancelled) return;

      const images = all.filter((x) => x.type !== 'video');
      const videos = all.filter((x) => x.type === 'video');
      if (!images.length && !videos.length) return;

      let width = mount.clientWidth || window.innerWidth;
      let height = mount.clientHeight || 480;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 200);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      mount.appendChild(renderer.domElement);

      const imageSpin = new THREE.Group();
      const videoTiltGroup = new THREE.Group();
      const videoSpin = new THREE.Group();
      videoTiltGroup.rotation.x = 0.18;
      videoTiltGroup.rotation.z = -0.06;
      videoTiltGroup.add(videoSpin);
      scene.add(imageSpin);
      scene.add(videoTiltGroup);

      const nImg = Math.max(images.length, 1);
      const r1 = Math.max(3.0, nImg * 0.5);
      camera.position.set(0, 0, r1 + 3.4);
      camera.lookAt(0, 0, 0);

      // Vòng trong: ảnh (view chính, hướng ra ngoài như hiện tại)
      if (images.length) addRing(THREE, imageSpin, images, r1, 1.9, false);

      // Vòng ngoài: video có group nghiêng riêng, còn spin group quay quanh trục của chính vòng video.
      if (videos.length) {
        const r2 = Math.max(r1 + 6, videos.length * 0.85, r1 * 1.8);
        addRing(THREE, videoSpin, videos, r2, 7.2, true);
      }

      let targetRot = 0;
      let curRot = 0;
      let dragging = false;
      let lastX = 0;
      let lastInteract = Date.now();

      const el = renderer.domElement as HTMLCanvasElement;
      const onDown = (x: number) => { dragging = true; lastX = x; lastInteract = Date.now(); };
      const onMove = (x: number) => {
        if (!dragging) return;
        targetRot += (x - lastX) * 0.005;
        lastX = x;
        lastInteract = Date.now();
      };
      const onUp = () => { dragging = false; };
      const md = (e: MouseEvent) => onDown(e.clientX);
      const mm = (e: MouseEvent) => onMove(e.clientX);
      const mu = () => onUp();
      const td = (e: TouchEvent) => onDown(e.touches[0].clientX);
      const tm = (e: TouchEvent) => onMove(e.touches[0].clientX);
      const tu = () => onUp();
      el.addEventListener('mousedown', md);
      window.addEventListener('mousemove', mm);
      window.addEventListener('mouseup', mu);
      el.addEventListener('touchstart', td, { passive: true });
      el.addEventListener('touchmove', tm, { passive: true });
      el.addEventListener('touchend', tu);
      cleanupPointer = () => {
        el.removeEventListener('mousedown', md);
        window.removeEventListener('mousemove', mm);
        window.removeEventListener('mouseup', mu);
        el.removeEventListener('touchstart', td);
        el.removeEventListener('touchmove', tm);
        el.removeEventListener('touchend', tu);
      };

      const animate = () => {
        if (!dragging && Date.now() - lastInteract > 1200) targetRot += 0.0016;
        curRot += (targetRot - curRot) * 0.08;
        imageSpin.rotation.y = curRot;
        videoSpin.rotation.y = curRot;
        renderer.render(scene, camera);
        frameId = requestAnimationFrame(animate);
      };
      animate();

      onResize = () => {
        if (!mount) return;
        width = mount.clientWidth || window.innerWidth;
        height = mount.clientHeight || 480;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      };
      window.addEventListener('resize', onResize);
    }

    function ensureThree(cb: () => void) {
      if ((window as any).THREE) return cb();
      let script = document.querySelector('script[data-three]') as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.src = SRC;
        script.setAttribute('data-three', 'true');
        document.body.appendChild(script);
      }
      script.addEventListener('load', cb);
    }

    fetch('/album')
      .then((r) => r.json())
      .then((all: Item[]) => ensureThree(() => startWithAlbum(Array.isArray(all) ? all : [])))
      .catch(() => ensureThree(() => startWithAlbum([])));

    return () => {
      cancelled = true;
      if (frameId) cancelAnimationFrame(frameId);
      if (onResize) window.removeEventListener('resize', onResize);
      if (cleanupPointer) cleanupPointer();
      videoEls.forEach((v) => { try { v.pause(); v.src = ''; } catch {} });
      if (renderer && mount && renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
        renderer.dispose();
      }
    };
  }, []);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.06)',
    color: '#e8edf5',
    fontSize: 14,
    marginTop: 8,
    boxSizing: 'border-box',
  };

  return (
    <main
      style={{
        position: 'relative',
        minHeight: '100vh',
        margin: 0,
        background: 'radial-gradient(1200px circle at 50% -10%, #1e293b, #0b0f17 60%)',
        color: '#e8edf5',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '40px 16px',
        textAlign: 'center',
      }}
    >
      <button
        onClick={() => { setPanelOpen((v) => !v); setStatus(''); }}
        style={{
          position: 'absolute',
          top: 18,
          right: 18,
          padding: '10px 16px',
          borderRadius: 999,
          border: '1px solid rgba(255,255,255,0.15)',
          background: 'rgba(255,255,255,0.08)',
          color: '#e8edf5',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
        }}
      >
        ＋ Tải ảnh / video
      </button>

      {panelOpen && (
        <div
          style={{
            position: 'absolute',
            top: 64,
            right: 18,
            width: 300,
            padding: 16,
            borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(17,23,38,0.96)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            textAlign: 'left',
            zIndex: 10,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 15 }}>Tải lên album</div>
          <div style={{ fontSize: 12, color: '#9aa6b8', marginTop: 4 }}>
            Chọn nhiều tệp được. Ảnh iPhone (HEIC) sẽ tự đổi sang JPG. Video (.mp4/.mov) vào vòng ngoài.
          </div>
          <input
            type="password"
            placeholder="Mật khẩu"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            style={inputStyle}
          />
          <input
            type="file"
            accept="image/*,video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,.m4v,.ogv,.heic,.heif,.pvt"
            multiple
            onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])}
            style={{ ...inputStyle, padding: '8px' }}
          />
          {files.length > 0 && (
            <div style={{ fontSize: 12, color: '#9aa6b8', marginTop: 6 }}>
              Đã chọn {files.length} tệp
            </div>
          )}
          <button
            onClick={doUpload}
            disabled={busy}
            style={{
              width: '100%',
              marginTop: 12,
              padding: '10px 12px',
              borderRadius: 8,
              border: 'none',
              background: busy ? '#3730a3' : 'linear-gradient(90deg,#6366f1,#22d3ee)',
              color: '#06121a',
              fontWeight: 700,
              fontSize: 14,
              cursor: busy ? 'default' : 'pointer',
            }}
          >
            {busy ? 'Đang tải...' : 'Tải lên'}
          </button>
          {status && (
            <div style={{ marginTop: 10, fontSize: 12, color: '#9aa6b8', wordBreak: 'break-word' }}>{status}</div>
          )}
        </div>
      )}

      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px',
          borderRadius: 999,
          border: '1px solid rgba(255,255,255,0.12)',
          fontSize: 13,
          color: '#9aa6b8',
          marginBottom: 14,
        }}
      >
        Album 3D • ảnh (vòng trong) + video (vòng ngoài)
      </div>
      <h1 style={{ fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 800, margin: '0 0 6px' }}>
        Album ảnh của tôi
      </h1>
      <p style={{ color: '#9aa6b8', maxWidth: 580, margin: '0 0 8px' }}>
        Kéo để xoay. Ảnh ở vòng trong, video chạy ở vòng ngoài phía sau.
      </p>

      <div
        ref={mountRef}
        style={{ width: 'min(1040px, 98vw)', height: '74vh', minHeight: 440, cursor: 'grab' }}
      />
    </main>
  );
}
