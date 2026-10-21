import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { clamp, smooth, getLayout, pathX, pathZ, curvePeak, curveSideOfWorm } from '../Helpers/wormPath';
import WormStop from '../Helpers/WormStop';
import './WormSection.scss';

const ACCENT = 0xe51f26; // rojo de la marca (reflejo en los bordes)

// ── Ajustes rápidos ──────────────────────────────────────────────
// (el ancho y el largo de las curvas están en wormPath.js)
const WORM_COLOR = 0x0a0a0a; // color del gusano (negro brillante; 0xe51f26 = rojo de la marca)
const WORM_LENGTH = 1.3;     // largo del cuerpo, en alturas de pantalla
const HEAD_FRAC = 0.62;      // dónde queda la cabeza en la pantalla al avanzar (0 = arriba, 1 = abajo)
const HEAD_START = 1.06;     // al empezar, la cabeza viene desde abajo de la pantalla
const HEAD_RISE = 0.7;       // cuánto scroll tarda en subir de HEAD_START a HEAD_FRAC (en alturas de pantalla)
const ORIGIN_FRAC = 0;       // de dónde sale: 0 = justo del borde de abajo del hero
const ROUGHNESS = 0.22;      // brillo: 0 = espejo, 0.5 = mate
const RIM = 0;               // reflejo rojo en los bordes (0 = sin reflejo)
// ─────────────────────────────────────────────────────────────────

/**
 * El gusano que baja con el scroll.
 * `stops`: pop-ups que van en las curvas. Cada uno: { id, curve, render(open, side) }
 *   - curve: número de curva (1 = la primera). El pop-up sale del lado contrario a la punta de la curva.
 *   - render(open, side): devuelve lo que se dibuja; `open` es true mientras el pop-up está en cámara.
 */
export default function WormSection({ stops = [] }) {
  const sectionRef = useRef(null);
  const canvasRef = useRef(null);
  const layoutRef = useRef(null);
  const [layout, setLayout] = useState(null); // medidas del recorrido (para ubicar los pop-ups)

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Transparente: el hero se ve por debajo en la parte donde se superponen
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 10, 10000);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
    scene.environment = envTex;
    scene.add(new THREE.AmbientLight(0xffffff, 0.25));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-0.5, 0.7, 1);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(ACCENT, RIM);
    rim.position.set(0.9, -0.3, -1);
    scene.add(rim);

    const material = new THREE.MeshPhysicalMaterial({
      color: WORM_COLOR, metalness: 0, roughness: ROUGHNESS,
      clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.1,
    });
    const geometry = new THREE.SphereGeometry(1, 28, 18);
    const group = new THREE.Group();
    scene.add(group);
    const dummy = new THREE.Object3D();

    let width = 0, height = 1, camDist = 1, curDpr = 0;
    let mesh = null, count = 0, spacing = 8;
    let smoothScroll = window.scrollY, lastNow = 0, frame = 0, disposed = false;

    function buildWorm(L) {
      if (mesh) { group.remove(mesh); mesh.dispose(); mesh = null; }
      spacing = Math.max(6, L.radius * 0.38);
      count = Math.ceil((WORM_LENGTH * height) / spacing) + 1;
      mesh = new THREE.InstancedMesh(geometry, material, count);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      group.add(mesh);
    }

    // Solo se reconstruye si el tamaño cambió de verdad. En el celular, la barra del navegador
    // aparece y desaparece al cambiar la dirección del scroll y dispara eventos de resize:
    // reconstruir todo en ese momento hacía que se trabara un instante.
    function resize(force = false) {
      const w = canvas.clientWidth, h = canvas.clientHeight || 1;
      const d = Math.min(window.devicePixelRatio || 1, 2);
      if (!force && w === width && h === height && d === curDpr) return;
      curDpr = d;
      width = w; height = h;
      renderer.setPixelRatio(d);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camDist = height / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      camera.far = camDist * 4;
      camera.position.set(0, 0, camDist);
      camera.updateProjectionMatrix();

      const L = { ...getLayout(width, height), width, height };
      layoutRef.current = L;
      setLayout(L);
      buildWorm(L);
    }

    function tick(now) {
      if (disposed) return;
      frame = requestAnimationFrame(tick);
      const dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0.016;
      lastNow = now;

      // Si la sección no está en pantalla no se dibuja nada
      const canvasRect = canvas.getBoundingClientRect();
      if (canvasRect.bottom < 0 || canvasRect.top > window.innerHeight || !mesh) return;
      const sectionRect = section.getBoundingClientRect();
      const L = layoutRef.current;

      // Scroll con un poco de inercia: la cabeza se atrasa un instante y después alcanza
      const scrollY = window.scrollY;
      smoothScroll = reduceMotion ? scrollY : smoothScroll + (scrollY - smoothScroll) * (1 - Math.exp(-dt * 9));

      // Todo en coordenadas de pantalla (viewport)
      const originVy = sectionRect.top + ORIGIN_FRAC * height;                 // de dónde sale (borde del hero)
      // Al principio la cabeza viene desde abajo de la pantalla y después sube hasta HEAD_FRAC
      const entered = clamp((height - sectionRect.top) / height);              // 0 = el hero recién termina, 1 = ya pasó una pantalla
      const frac = HEAD_FRAC + (HEAD_START - HEAD_FRAC) * (1 - smooth(entered / HEAD_RISE));
      const headVy = frac * height - (scrollY - smoothScroll);                 // dónde está la cabeza
      const headDist = Math.max(0, headVy - originVy);                         // cuánto recorrió

      // El grupo se mueve para que "d = 0" coincida con el origen dentro del canvas
      group.position.y = height / 2 - (originVy - canvasRect.top);

      const t = now / 1000;
      const last = Math.max(1, count - 1);
      for (let i = 0; i < count; i++) {
        const d = headDist - i * spacing; // distancia al origen de esta esfera (0 = recién sale)
        if (d <= 0) {
          dummy.scale.set(0, 0, 0);
          dummy.position.set(0, 0, 0);
        } else {
          const u = i / last; // 0 = cabeza, 1 = cola
          const taper = 1 - 0.62 * Math.pow(u, 1.5);                         // se afina hacia la cola
          const wave = 1 + 0.1 * Math.sin(i * 0.5 - t * 5);                  // ondulación de reptar
          const emerge = clamp(d / (L.radius * 1.6));                        // crece al salir
          const head = i === 0 ? 1.12 : 1;
          const r = L.radius * taper * wave * emerge * head;
          dummy.position.set(pathX(d, L), -d, pathZ(d, L));
          dummy.scale.set(r, r, r);
        }
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      renderer.render(scene, camera);
    }

    resize(true);
    frame = requestAnimationFrame(tick);
    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(canvas);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      if (mesh) mesh.dispose();
      geometry.dispose(); material.dispose();
      envTex.dispose(); pmrem.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <section className="worm" ref={sectionRef}>
      <div className="worm__sticky">
        <canvas ref={canvasRef} className="worm__canvas" aria-hidden="true" />
      </div>

      {/* Pop-ups: cada uno va en su curva, del lado contrario a la punta del gusano */}
      {layout && stops.map((stop) => (
        <WormStop
          key={stop.id}
          side={curveSideOfWorm(stop.curve) === 'right' ? 'left' : 'right'}
          y={ORIGIN_FRAC * layout.height + curvePeak(stop.curve, layout)}
          render={stop.render}
        />
      ))}
    </section>
  );
}
