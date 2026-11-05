import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CATEGORIES } from './categories.js';
import { buildGarment } from './garments/index.js';
import './CategoryCarousel.scss';

// ── Ajustes rápidos ──────────────────────────────────────────────
const SPACING = 2.7;      // distancia entre prendas (unidades 3D)
const SPIN_SPEED = 0.55;  // giro de la prenda del centro (radianes por segundo)
const SPIN_SIDE = 0.3;    // giro de las prendas de los costados
const SIDE_SCALE = 0.5;   // tamaño de las de los costados (1 = igual que la del centro)
const SIDE_LIGHT = 0.2;   // brillo de las de los costados (0 = negras, 1 = igual)
const SPRING = 70;        // rigidez del deslizamiento (más alto = más rápido)
const DAMPING = 13;       // freno (más alto = menos rebote al frenar)
const ENTER_TIME = 0.9;   // segundos que tarda cada prenda en aparecer al entrar a la sección
// ─────────────────────────────────────────────────────────────────

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const mod = (a, n) => ((a % n) + n) % n;
const wrapRel = (v, n) => v - n * Math.round(v / n); // distancia con signo, dando la vuelta al carrusel
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

// onSelect(id): se llama al tocar "Ver más" con la categoría que está en el centro
export default function CategoryCarousel({ onSelect }) {
  const n = CATEGORIES.length;
  const canvasRef = useRef(null);
  const api = useRef({});
  const [active, setActive] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dprMax = window.matchMedia('(pointer: coarse)').matches ? 1.5 : 2;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0); // transparente: el fondo es el del escenario
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
    scene.environment = envTex;
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(-2, 3, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 1.2);
    rim.position.set(3, 1, -3);
    scene.add(rim);

    // Una prenda por categoría, cada una con sus materiales (así se pueden oscurecer por separado)
    const garments = CATEGORIES.map((cat, i) => {
      const mats = {
        cloth: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.6, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffffff), envMapIntensity: 0.9 }),
        detail: new THREE.MeshPhysicalMaterial({ color: 0xdcdcdc, roughness: 0.65, sheen: 1, sheenRoughness: 0.6, envMapIntensity: 0.8 }),
        inner: new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.9 }),
      };
      const holder = new THREE.Group();
      holder.add(buildGarment(cat.model, mats));
      holder.visible = false;
      scene.add(holder);
      return { i, mats, holder, ang: reduceMotion ? 0.5 : i * 2.1 };
    });

    let width = 0, height = 0, pxPerUnit = 1;
    let pos = 0, vel = 0, target = 0;         // posición actual, velocidad y destino (en "lugares" del carrusel)
    let activeNow = 0;
    let onScreen = false, started = false, enterT = reduceMotion ? 99 : 0;
    let last = 0, frame = 0, disposed = false;

    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      width = w; height = h;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprMax));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const k = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      // En pantallas angostas la cámara se aleja para que la prenda del centro entre completa
      camera.position.set(0, 0.1, Math.max(7.6, 3.6 / camera.aspect / k));
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      pxPerUnit = h / (k * camera.position.z);
    }

    // ── Navegación ──────────────────────────────────────────────
    function syncActive(r) {
      const idx = mod(Math.round(r), n);
      if (idx !== activeNow) { activeNow = idx; setActive(idx); }
    }
    function commit(t) { target = t; syncActive(t); }
    api.current = {
      go: (d) => commit(Math.round(target) + d),
      goTo: (i) => commit(Math.round(target) + wrapRel(i - Math.round(target), n)),
    };

    // Arrastrar / swipe: el carrusel sigue al dedo y al soltar se acomoda en la prenda más cercana
    let dragging = false, dragX = 0, dragStart = 0, lastX = 0, lastT = 0, dragVel = 0;
    const onDown = (e) => {
      dragging = true; dragX = lastX = e.clientX; dragStart = target; lastT = performance.now(); dragVel = 0;
      canvas.setPointerCapture?.(e.pointerId);
      canvas.classList.add('is-grabbing');
    };
    const onMove = (e) => {
      if (!dragging) return;
      const perItem = SPACING * pxPerUnit;
      target = dragStart - (e.clientX - dragX) / perItem;
      const now = performance.now();
      const inst = -(e.clientX - lastX) / perItem / Math.max(0.008, (now - lastT) / 1000);
      dragVel += (inst - dragVel) * 0.4;
      lastX = e.clientX; lastT = now;
      syncActive(target);
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      canvas.classList.remove('is-grabbing');
      const base = Math.round(dragStart);
      const flick = clamp(dragVel * 0.12, -0.9, 0.9); // un swipe rápido avanza aunque no se arrastre mucho
      commit(clamp(Math.round(target + flick), base - 1, base + 1)); // como máximo una prenda por gesto
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    // ── Animación ───────────────────────────────────────────────
    function tick(now) {
      if (disposed) return;
      frame = requestAnimationFrame(tick);
      if (!onScreen) { last = 0; return; } // fuera de pantalla no se dibuja
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      const t = now / 1000;
      if (started) enterT += dt;

      if (reduceMotion) { pos = target; vel = 0; } else {
        vel += (SPRING * (target - pos) - DAMPING * vel) * dt; // resorte: llega con una pizca de rebote
        pos += vel * dt;
      }

      for (const g of garments) {
        const rel = wrapRel(g.i - pos, n);          // lugares de distancia al centro (con signo)
        const a = Math.abs(rel);
        const near = 1 - clamp(a);                  // 1 en el centro, 0 al costado
        const k = easeOut(clamp(a));
        // Los costados se oscurecen y, pasando el costado, se apagan del todo (así dan la vuelta sin saltos)
        const fade = a <= 1 ? 1 - (1 - SIDE_LIGHT) * k : SIDE_LIGHT * clamp(1 - (a - 1) / 0.5);
        const e = started ? easeOutBack(clamp((enterT - 0.15 * a) / ENTER_TIME)) : 0; // entrada
        g.holder.visible = fade > 0.01 && e > 0.001;
        if (!g.holder.visible) continue;

        if (!reduceMotion) g.ang += dt * (SPIN_SIDE + (SPIN_SPEED - SPIN_SIDE) * near) + vel * dt * 1.2; // al deslizar giran un poco más
        const bob = reduceMotion ? 0 : Math.sin(t * 1.1 + g.i * 1.7) * 0.05 * (0.5 + 0.5 * near);
        g.holder.position.set(rel * SPACING, bob - (1 - Math.min(e, 1)) * 0.9, -1.4 * k);
        g.holder.scale.setScalar(Math.max(0.001, (1 - (1 - SIDE_SCALE) * k) * e));
        g.holder.rotation.set(0, g.ang + (1 - Math.min(e, 1)) * 2.2, clamp(-vel * 0.03, -0.2, 0.2));

        const f2 = fade * fade;
        g.mats.cloth.color.setScalar(f2);
        g.mats.detail.color.setScalar(0.86 * f2);
        g.mats.inner.color.setScalar(0.17 * f2);
      }
      renderer.render(scene, camera);
    }

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    // Empieza a dibujar cuando aparece en pantalla; la entrada arranca cuando se ve un buen pedazo
    const visibility = new IntersectionObserver(([en]) => {
      onScreen = en.isIntersecting;
      if (en.intersectionRatio > 0.3) started = true;
    }, { threshold: [0, 0.3] });
    visibility.observe(canvas);
    frame = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibility.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      for (const g of garments) {
        g.holder.traverse((o) => o.geometry?.dispose());
        Object.values(g.mats).forEach((m) => m.dispose());
      }
      envTex.dispose(); pmrem.dispose(); renderer.dispose();
    };
  }, [n]);

  const rel = (i) => { const r = i - active; return r - n * Math.round(r / n); }; // -1, 0 o 1: dónde está cada texto
  const onKeyDown = (e) => {
    if (e.key === 'ArrowLeft') api.current.go?.(-1);
    if (e.key === 'ArrowRight') api.current.go?.(1);
  };

  return (
    <section className="cc" aria-roledescription="carousel" aria-label="Categorías" tabIndex={0} onKeyDown={onKeyDown}>
      <div className="cc__stage">
        {/* Nombre gigante detrás de la prenda */}
        <div className="cc__names" aria-live="polite">
          {CATEGORIES.map((c, i) => (
            <span key={c.id} className="cc__name" data-rel={rel(i)} aria-hidden={rel(i) !== 0}>{c.label}</span>
          ))}
        </div>

        <canvas ref={canvasRef} className="cc__canvas" aria-label="Prendas en 3D, deslizá para cambiar de categoría" />

        <div className="cc__top" aria-hidden="true">
          <span className="cc__eyebrow">Categorías</span>
          <span className="cc__count">
            <span className="cc__num">
              {CATEGORIES.map((c, i) => <span key={c.id} data-rel={rel(i)}>{String(i + 1).padStart(2, '0')}</span>)}
            </span>
            <span className="cc__of">/ {String(n).padStart(2, '0')}</span>
          </span>
        </div>

        <button className="cc__arrow cc__arrow--prev" type="button" aria-label="Categoría anterior" onClick={() => api.current.go?.(-1)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5" /></svg>
        </button>
        <button className="cc__arrow cc__arrow--next" type="button" aria-label="Categoría siguiente" onClick={() => api.current.go?.(1)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 5.5 16 12l-6.5 6.5" /></svg>
        </button>

        <div className="cc__bottom">
          <button className="cc__more" type="button" onClick={() => onSelect?.(CATEGORIES[active].id)}>Ver más</button>
          <div className="cc__dots">
            {CATEGORIES.map((c, i) => (
              <button
                key={c.id}
                type="button"
                className={`cc__dot${i === active ? ' is-active' : ''}`}
                aria-label={`Ir a ${c.label}`}
                aria-current={i === active}
                onClick={() => api.current.goTo?.(i)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
