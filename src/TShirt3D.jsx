import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createShirtGeometry } from './shirtGeometry';
import './TShirt3D.scss';

// ── Ajustes rápidos ──────────────────────────────────────────────
const SPIN_SPEED = 0.9;        // vueltas: radianes por segundo
const CAMERA_DISTANCE = 5.6;   // más alto = la remera se ve más chica
const FABRIC_BUMP = 0.4;       // textura de tela (0 = lisa)
// ─────────────────────────────────────────────────────────────────

// Trama de tela diagonal con un poco de ruido
function makeWeaveTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = 128 + ((x + y) % 4 < 2 ? 28 : -28) + (Math.random() - 0.5) * 40;
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  return texture;
}

/**
 * Remera 3D girando. Solo se dibuja cuando `active` es true (así no gasta mientras el pop-up está cerrado).
 * `color`: color de la tela.
 * Ocupa todo el espacio de su contenedor (que debe tener position: relative y un tamaño).
 */
export default function TShirt3D({ active = false, color = 0xf2f2f2 }) {
  const canvasRef = useRef(null);
  const controls = useRef({ start() {}, stop() {} });

  useEffect(() => {
    const canvas = canvasRef.current;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    camera.position.set(0, 0, CAMERA_DISTANCE);

    // Luz de estudio: reflejos suaves + una luz principal + un filo de luz por detrás
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
    scene.environment = envTex;
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const key = new THREE.DirectionalLight(0xffffff, 2);
    key.position.set(-1.5, 2.5, 3);
    scene.add(key);
    const back = new THREE.DirectionalLight(0xffffff, 1.2);
    back.position.set(2, 1, -3);
    scene.add(back);

    const geometry = createShirtGeometry();
    const weave = makeWeaveTexture();
    const material = new THREE.MeshPhysicalMaterial({
      color, roughness: 0.85, metalness: 0,
      sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(0xffffff), // brillo suave de tela
      bumpMap: weave, bumpScale: FABRIC_BUMP, envMapIntensity: 0.9,
    });
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geometry, material));
    scene.add(group);

    let running = false, frame = 0, last = 0, onScreen = true, angle = -0.5;
    let width = 0, height = 0;

    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const d = Math.min(window.devicePixelRatio || 1, 2);
      if (!w || !h) return;
      if (w === width && h === height && d === renderer.getPixelRatio()) return;
      width = w; height = h;
      renderer.setPixelRatio(d);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    }

    function tick(now) {
      frame = requestAnimationFrame(tick);
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      if (!onScreen) return;
      angle += dt * SPIN_SPEED;
      group.rotation.y = angle;
      group.rotation.x = Math.sin(now / 1000 * 0.6) * 0.07;   // pequeño cabeceo
      group.position.y = Math.sin(now / 1000 * 1.1) * 0.04;   // flota apenas
      renderer.render(scene, camera);
    }

    controls.current = {
      start() {
        resize();
        if (reduceMotion) { renderer.render(scene, camera); return; } // quieta, sin girar
        if (running) return;
        running = true; last = 0;
        frame = requestAnimationFrame(tick);
      },
      stop() {
        running = false;
        cancelAnimationFrame(frame);
      },
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const visibility = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; });
    visibility.observe(canvas);

    return () => {
      controls.current.stop();
      controls.current = { start() {}, stop() {} };
      resizeObserver.disconnect();
      visibility.disconnect();
      geometry.dispose(); material.dispose(); weave.dispose();
      envTex.dispose(); pmrem.dispose();
      renderer.dispose();
    };
  }, [color]);

  // Gira solo mientras el pop-up está abierto
  useEffect(() => {
    if (active) controls.current.start();
    else controls.current.stop();
  }, [active, color]);

  return (
    <div className="tshirt3d">
      <canvas ref={canvasRef} className="tshirt3d__canvas" aria-hidden="true" />
    </div>
  );
}
