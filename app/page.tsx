'use client';

import { useEffect, useRef, useState } from 'react';

export default function Home() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [renderedAt, setRenderedAt] = useState('');

  useEffect(() => {
    setRenderedAt(new Date().toLocaleString());
  }, []);

  useEffect(() => {
    const SRC = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    const mount = mountRef.current;
    let frameId = 0;
    let renderer: any = null;
    let onResize: (() => void) | null = null;

    function start() {
      const THREE = (window as any).THREE;
      if (!THREE || !mount) return;

      let width = mount.clientWidth || window.innerWidth;
      let height = mount.clientHeight || 420;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
      camera.position.set(0, 0, 4.2);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      mount.appendChild(renderer.domElement);

      const geometry = new THREE.TorusKnotGeometry(1, 0.34, 180, 28);
      const material = new THREE.MeshStandardMaterial({
        color: 0x6366f1,
        roughness: 0.25,
        metalness: 0.6,
      });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      const light1 = new THREE.DirectionalLight(0x22d3ee, 2.2);
      light1.position.set(3, 2, 4);
      scene.add(light1);
      const light2 = new THREE.DirectionalLight(0xf472b6, 1.6);
      light2.position.set(-3, -2, 2);
      scene.add(light2);
      scene.add(new THREE.AmbientLight(0xffffff, 0.4));

      const animate = () => {
        mesh.rotation.x += 0.006;
        mesh.rotation.y += 0.012;
        renderer.render(scene, camera);
        frameId = requestAnimationFrame(animate);
      };
      animate();

      onResize = () => {
        if (!mount) return;
        width = mount.clientWidth || window.innerWidth;
        height = mount.clientHeight || 420;
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
        justifyContent: 'center',
        padding: '24px',
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
          marginBottom: 18,
        }}
      >
        Server-rendered with Next.js on Render • Three.js
      </div>
      <h1 style={{ fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 800, margin: '0 0 6px' }}>
        Trang động 3D
      </h1>
      <p style={{ color: '#9aa6b8', maxWidth: 520, margin: '0 0 22px' }}>
        Trang này được phục vụ bởi một Next.js server (Node) trên Render, khác với portfolio tĩnh.
      </p>

      <div
        ref={mountRef}
        style={{
          width: 'min(680px, 92vw)',
          height: 420,
          borderRadius: 18,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      />

      <p style={{ color: '#64748b', fontSize: 12, marginTop: 18 }}>
        Rendered by server at {renderedAt}
      </p>
    </main>
  );
}
