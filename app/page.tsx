'use client';

import { useEffect, useRef } from 'react';

// Ảnh lấy từ folder "album" trên Google Drive (đồng bộ thủ công).
// Thêm ảnh mới: bổ sung { id, title } vào mảng dưới đây.
const ALBUM: { id: string; title: string }[] = [
  { id: '1Fqi0zOLVGN9fzMg9YtY2pOC3u7q-WyfN', title: 'IMG_4116' },
  { id: '1wYj-b5adY_woFDeDqwGdPBJDAT6hdVNV', title: 'IMG_2465' },
];

export default function Home() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const SRC = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    const mount = mountRef.current;
    let frameId = 0;
    let renderer: any = null;
    let onResize: (() => void) | null = null;
    let cleanupPointer: (() => void) | null = null;

    function start() {
      const THREE = (window as any).THREE;
      if (!THREE || !mount) return;

      let width = mount.clientWidth || window.innerWidth;
      let height = mount.clientHeight || 480;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      mount.appendChild(renderer.domElement);

      const group = new THREE.Group();
      scene.add(group);

      const N = Math.max(ALBUM.length, 1);
      const radius = Math.max(3.4, N * 0.62);
      camera.position.set(0, 0, radius + 3.4);
      camera.lookAt(0, 0, 0);

      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin('anonymous');
      const H = 1.9;

      ALBUM.forEach((item, i) => {
        const a = (i / N) * Math.PI * 2;
        // khung nền cho ảnh
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
        frame.rotation.y = a;
        group.add(frame);

        loader.load(
          `/photo?id=${item.id}`,
          (tex: any) => {
            tex.anisotropy = renderer.capabilities.getMaxAnisotropy
              ? renderer.capabilities.getMaxAnisotropy()
              : 1;
            const img = tex.image;
            const aspect = img && img.width && img.height ? img.width / img.height : 0.78;
            const w = H * aspect;
            mesh.geometry.dispose();
            mesh.geometry = new THREE.PlaneGeometry(w, H);
            (frame.geometry as any).dispose();
            frame.geometry = new THREE.PlaneGeometry(w + 0.12, H + 0.12);
            (mesh.material as any).color.set(0xffffff);
            (mesh.material as any).map = tex;
            (mesh.material as any).needsUpdate = true;
          },
          undefined,
          () => {}
        );
      });

      // Tương tác: kéo để xoay + tự xoay nhẹ
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
      const tm = (e: TouchEvent) => { onMove(e.touches[0].clientX); };
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
        if (!dragging && Date.now() - lastInteract > 1200) {
          targetRot += 0.0016;
        }
        curRot += (targetRot - curRot) * 0.08;
        group.rotation.y = curRot;
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

    if ((window as any).THREE) {
      start();
    } else {
      let script = document.querySelector('script[data-three]') as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.src = SRC;
        script.setAttribute('data-three', 'true');
        document.body.appendChild(script);
      }
      script.addEventListener('load', start);
    }

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      if (onResize) window.removeEventListener('resize', onResize);
      if (cleanupPointer) cleanupPointer();
      if (renderer && mount && renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
        renderer.dispose();
      }
    };
  }, []);

  return (
    <main
      style={{
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
        Album 3D • Next.js server • ảnh từ Google Drive
      </div>
      <h1 style={{ fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 800, margin: '0 0 6px' }}>
        Album ảnh của tôi
      </h1>
      <p style={{ color: '#9aa6b8', maxWidth: 560, margin: '0 0 8px' }}>
        Kéo chuột (hoặc vuốt) để xoay vòng ảnh. Ảnh được server lấy trực tiếp từ Google Drive.
      </p>

      <div
        ref={mountRef}
        style={{
          width: 'min(960px, 96vw)',
          height: '70vh',
          minHeight: 420,
          cursor: 'grab',
        }}
      />
    </main>
  );
}
