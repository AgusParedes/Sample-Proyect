import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CATEGORIES } from './categories.js';
import { buildGarment, loadRealModel, GARMENT_SIZE } from './garments/index.js';
import './CategoryCarousel.scss';

// ── Ajustes rápidos ──────────────────────────────────────────────
const GAP = 24;           // separación entre tarjetas (px)
const SIDE_SCALE = 0.86;  // tamaño de las tarjetas de los costados (1 = igual que la del centro)
const SIDE_OPACITY = 0.55; // qué tan visibles quedan las de los costados
const GARMENT_FILL = 0.78; // qué parte del alto del recuadro ocupa la prenda
const SPIN_SPEED = 0.55;  // giro de la prenda de la tarjeta del centro (radianes por segundo)
const SPIN_SIDE = 0.3;    // giro de las prendas de los costados
const SPRING = 70;        // rigidez del deslizamiento (más alto = más rápido)
const DAMPING = 13;       // freno (más alto = menos rebote al frenar)
// Luz y rendimiento
const GARMENT_TINT = 0.72;  // claridad de la tela: 1 = blanco puro, más bajo = más gris (y más sombra). Si se ve muy oscura, subilo
const ENV_LIGHT = 0.32;     // luz suave de ambiente: más bajo = sombras más marcadas
const MIN_PIXEL_RATIO = 0.75; // si la compu va lenta, la resolución baja sola hasta este valor
// ─────────────────────────────────────────────────────────────────

const PX = 100; // 1 unidad 3D = 100 px de pantalla en el plano de las tarjetas
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const mod = (a, n) => ((a % n) + n) % n;
const wrapRel = (v, n) => v - n * Math.round(v / n); // distancia con signo, dando la vuelta al carrusel
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

const materialsOf = (root) => {
  const out = [];
  root.traverse((o) => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m && out.push(m)); });
  return out;
};
// Guarda el color original de cada material para poder oscurecerlo en las tarjetas de los costados
const dimList = (mats) => [...new Set(mats)].filter((m) => m.color).map((m) => ({ m, base: m.color.clone() }));
// Ajusta las prendas .glb para que no se vean brillantes ni quemadas: sin metal, tela mate y un poco más oscura
function tuneRealModel(root) {
  for (const m of new Set(materialsOf(root))) {
    m.metalness = 0;
    m.roughness = Math.max(m.roughness ?? 1, 0.88);
    m.envMapIntensity = ENV_LIGHT;
    if ('sheen' in m) m.sheen = 0;
    m.emissiveMap = null;
    m.emissive?.setScalar(0);
    m.flatShading = false;
    m.side = THREE.DoubleSide; // por si algún triángulo quedó dado vuelta: se ve igual en vez de quedar un agujero
    m.color?.multiplyScalar(GARMENT_TINT);
    m.needsUpdate = true;
  }
}
const whenIdle = (cb) => (window.requestIdleCallback ? window.requestIdleCallback(cb, { timeout: 1500 }) : setTimeout(cb, 250));
function disposeTree(root) {
  root.traverse((o) => {
    o.geometry?.dispose();
    if (!o.isMesh) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
      for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) m?.[key]?.dispose();
      m?.dispose();
    });
  });
}

// onSelect(id): se llama al tocar "Ver más" con el id de la categoría ('remeras', 'buzos'...)
// play: cuando pasa a true arranca la animación de entrada (las tarjetas salen del centro); al volver a false se reinicia
export default function CategoryCarousel({ onSelect, play = true }) {
  const n = CATEGORIES.length;
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const cardRefs = useRef([]);
  const mediaRefs = useRef([]);
  const api = useRef({});
  const playRef = useRef(play);
  playRef.current = play;
  const [active, setActive] = useState(0);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dprMax = window.matchMedia('(pointer: coarse)').matches ? 1.25 : 1.5; // tope de resolución: más alto = más nítido pero más pesado

    // Un solo canvas transparente encima de las tarjetas: cada prenda 3D se dibuja justo sobre el recuadro de su tarjeta
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: (window.devicePixelRatio || 1) < 2, alpha: true }); // en pantallas muy densas el suavizado casi no se nota y cuesta mucho
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = ENV_LIGHT; // (en three viejo se usa envMapIntensity de cada material, que también está ajustado)
    scene.add(new THREE.AmbientLight(0xffffff, 0.08));
    // Una luz principal fuerte y de costado: el lado opuesto queda en sombra y se marca el volumen
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-3.5, 2.5, 2.5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.45); // contraluz suave, solo para despegar el borde del fondo
    rim.position.set(3, 1, -3);
    scene.add(rim);

    let disposed = false;
    const garments = CATEGORIES.map((cat, i) => {
      const mats = {
        cloth: new THREE.MeshStandardMaterial({ color: new THREE.Color(0xffffff).multiplyScalar(GARMENT_TINT), roughness: 0.88, metalness: 0, envMapIntensity: ENV_LIGHT }),
        detail: new THREE.MeshStandardMaterial({ color: new THREE.Color(0xdcdcdc).multiplyScalar(GARMENT_TINT), roughness: 0.9, metalness: 0, envMapIntensity: ENV_LIGHT }),
        inner: new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.9 }),
      };
      const holder = new THREE.Group();
      const model = buildGarment(cat.model, mats);
      holder.add(model);
      holder.visible = false;
      scene.add(holder);
      const g = { i, holder, model, cat, dim: dimList(Object.values(mats)), ang: reduceMotion ? 0.5 : i * 2.1, fade: 1, eg: 0 };
      return g;
    });

    // Los modelos .glb se cargan de a uno y cuando el navegador está libre, para no trabar el hero mientras tanto.
    // Hasta que llega cada uno se ve la prenda armada en código.
    let loadIdx = 0;
    const loadNext = () => {
      if (disposed || loadIdx >= garments.length) return;
      const g = garments[loadIdx++];
      loadRealModel(g.cat.model).then((real) => {
        if (disposed) { if (real) disposeTree(real); return; }
        if (real) {
          tuneRealModel(real);
          g.holder.remove(g.model);
          disposeTree(g.model);
          g.holder.add(real);
          g.model = real;
          g.dim = dimList(materialsOf(real));
          real.traverse((o) => { if (o.isMesh && o.material.normalMap) renderer.initTexture?.(o.material.normalMap); }); // sube la textura ahora y no cuando aparece
        }
        whenIdle(loadNext);
      });
    };
    const loadTimer = setTimeout(() => whenIdle(loadNext), 600);

    let width = 0, height = 0, step = 400;
    let pr = Math.min(window.devicePixelRatio || 1, dprMax), slowFor = 0, ema = 0.016, drawn = false;
    let pos = 0, vel = 0, target = 0;       // posición actual, velocidad y destino (en "lugares" del carrusel)
    let activeNow = 0;
    let onScreen = false, started = false, enterT = 0;
    let last = 0, frame = 0;

    function resize() {
      const w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) return;
      width = w; height = h;
      renderer.setPixelRatio(pr);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.position.set(0, 0, h / PX / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))));
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      const card = cardRefs.current[0];
      if (card) step = card.offsetWidth + GAP;
    }

    // ── Navegación ──────────────────────────────────────────────
    function syncActive(r) {
      const idx = mod(Math.round(r), n);
      if (idx !== activeNow) { activeNow = idx; setActive(idx); }
    }
    function commit(t) { target = t; syncActive(t); }
    let suppressClick = false;
    api.current = {
      go: (d) => commit(Math.round(target) + d),
      goTo: (i) => commit(Math.round(target) + wrapRel(i - Math.round(target), n)),
      clickCard: (i) => { if (!suppressClick && i !== activeNow) api.current.goTo(i); },
    };

    // Arrastrar / swipe: el carrusel sigue al dedo y al soltar se acomoda en la tarjeta más cercana.
    // El arrastre recién empieza después de mover unos píxeles, así los toques y clics siguen funcionando.
    let down = false, dragging = false, dragX = 0, dragStart = 0, lastX = 0, lastT = 0, dragVel = 0;
    const onDown = (e) => {
      if (e.target.closest('button')) return;
      down = true; dragging = false;
      dragX = lastX = e.clientX; dragStart = target; lastT = performance.now(); dragVel = 0;
    };
    const onMove = (e) => {
      if (!down) return;
      const dx = e.clientX - dragX;
      if (!dragging) {
        if (Math.abs(dx) < 6) return;
        dragging = true;
        stage.setPointerCapture?.(e.pointerId);
        stage.classList.add('is-grabbing');
      }
      target = dragStart - dx / step;
      const now = performance.now();
      const inst = -(e.clientX - lastX) / step / Math.max(0.008, (now - lastT) / 1000);
      dragVel += (inst - dragVel) * 0.4;
      lastX = e.clientX; lastT = now;
      syncActive(target);
    };
    const onUp = () => {
      if (!down) return;
      down = false;
      if (!dragging) return;
      dragging = false;
      stage.classList.remove('is-grabbing');
      suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); // que soltar no cuente como clic
      const base = Math.round(dragStart);
      const flick = clamp(dragVel * 0.12, -0.9, 0.9); // un swipe rápido avanza aunque no se arrastre mucho
      commit(clamp(Math.round(target + flick), base - 1, base + 1)); // como máximo una tarjeta por gesto
    };
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', onUp);

    // ── Animación ───────────────────────────────────────────────
    function tick(now) {
      if (disposed) return;
      frame = requestAnimationFrame(tick);
      if (!onScreen) { last = 0; return; } // fuera de pantalla no se dibuja
      const raw = last ? (now - last) / 1000 : 0.016;
      const dt = Math.min(0.05, raw);
      last = now;
      // Si va lento (menos de ~38 fps durante más de 1 segundo), baja la resolución de a poco hasta que ande fluido
      if (raw < 0.25) ema += (raw - ema) * 0.1;
      slowFor = ema > 0.026 ? slowFor + raw : 0;
      if (slowFor > 1 && pr > MIN_PIXEL_RATIO) {
        pr = Math.max(MIN_PIXEL_RATIO, pr - 0.25);
        renderer.setPixelRatio(pr);
        renderer.setSize(width, height, false);
        slowFor = 0; ema = 0.016;
      }
      const t = now / 1000;
      // La entrada arranca cuando la sección se muestra (play) y se reinicia si se vuelve a esconder
      if (playRef.current && !started) { started = true; enterT = reduceMotion ? 99 : 0; }
      else if (!playRef.current && started) { started = false; enterT = 0; }
      if (started) enterT += dt;

      if (reduceMotion) { pos = target; vel = 0; } else {
        vel += (SPRING * (target - pos) - DAMPING * vel) * dt; // resorte: llega con una pizca de rebote
        pos += vel * dt;
      }

      // 1) Tarjetas (CSS): posición, tamaño y visibilidad según la distancia al centro
      for (const g of garments) {
        const card = cardRefs.current[g.i];
        if (!card) continue;
        const rel = wrapRel(g.i - pos, n);
        const a = Math.abs(rel);
        const k = easeOut(clamp(a));
        // Los costados se apagan y, pasando el costado, desaparecen del todo (así dan la vuelta sin saltos)
        g.fade = a <= 1 ? 1 - (1 - SIDE_OPACITY) * k : SIDE_OPACITY * clamp(1 - (a - 1) / 0.5);
        // Entrada: las tarjetas salen del centro, como un mazo que se abre, y después la prenda aparece girando
        const appear = started ? easeOut(clamp((enterT - 0.06 * a) / 0.7)) : 0;                       // aparece y crece desde el centro
        const spread = lerp(1, started ? easeOut(clamp((enterT - 0.35) / 0.95)) : 0, clamp(a));      // se abre hacia los costados
        g.eg = started ? easeOutBack(clamp((enterT - 0.6 - 0.1 * a) / 0.9)) : 0;                       // la prenda entra girando
        g.a = a; g.k = k; g.rel = rel;
        const s = (1 - (1 - SIDE_SCALE) * k) * (0.6 + 0.4 * appear);
        const tilt = Math.sign(rel) * (1 - spread) * 7;                                                // al abrirse se inclinan un poco
        card.style.transform = `translate3d(calc(-50% + ${(rel * step * spread).toFixed(2)}px), 0, 0) rotate(${tilt.toFixed(2)}deg) scale(${s.toFixed(4)})`;
        card.style.opacity = (g.fade * appear).toFixed(3);
        card.style.pointerEvents = g.fade * appear > 0.25 ? 'auto' : 'none';
        card.style.zIndex = String(10 + Math.round((1 - clamp(a, 0, 1.5) / 1.5) * 10));
        g.cardVisible = g.fade * appear > 0.02;
      }

      // 2) Prendas (3D): cada una se pone justo sobre el recuadro de su tarjeta
      const cr = canvas.getBoundingClientRect();
      let anyVisible = false;
      for (const g of garments) {
        const media = mediaRefs.current[g.i];
        g.holder.visible = !!media && g.cardVisible && g.eg > 0.001;
        if (!g.holder.visible) continue;
        anyVisible = true;
        const r = media.getBoundingClientRect(); // ya incluye el tamaño y el movimiento de la tarjeta
        const x = (r.left + r.width / 2 - cr.left - width / 2) / PX;
        const y = -(r.top + r.height / 2 - cr.top - height / 2) / PX;
        const near = 1 - clamp(g.a);
        if (!reduceMotion) g.ang += dt * (SPIN_SIDE + (SPIN_SPEED - SPIN_SIDE) * near) + vel * dt * 1.2; // al deslizar giran un poco más
        const bob = reduceMotion ? 0 : Math.sin(t * 1.1 + g.i * 1.7) * 0.05 * (0.5 + 0.5 * near);
        g.holder.position.set(x, y + bob, 0);
        g.holder.scale.setScalar(Math.max(0.001, ((r.height * GARMENT_FILL) / (GARMENT_SIZE * PX)) * g.eg));
        g.holder.rotation.set(0, g.ang + (1 - Math.min(g.eg, 1)) * 2.2, clamp(-vel * 0.03, -0.2, 0.2));
        for (const d of g.dim) d.m.color.copy(d.base).multiplyScalar(g.fade);
      }
      if (anyVisible || drawn) { renderer.render(scene, camera); drawn = anyVisible; } // si no hay nada que mostrar, no se dibuja (solo una vez para limpiar)
    }

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stage);
    // Solo se dibuja cuando está en pantalla
    const visibility = new IntersectionObserver(([en]) => { onScreen = en.isIntersecting; });
    visibility.observe(stage);
    frame = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      clearTimeout(loadTimer);
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibility.disconnect();
      stage.removeEventListener('pointerdown', onDown);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerup', onUp);
      stage.removeEventListener('pointercancel', onUp);
      for (const g of garments) disposeTree(g.holder);
      envTex.dispose(); pmrem.dispose(); renderer.dispose();
    };
  }, [n]);

  const onKeyDown = (e) => {
    if (e.key === 'ArrowLeft') api.current.go?.(-1);
    if (e.key === 'ArrowRight') api.current.go?.(1);
  };

  return (
    <section className="cc" aria-roledescription="carousel" aria-label="Categorías" tabIndex={0} onKeyDown={onKeyDown}>
      <div className="cc__head">
        <span className="cc__eyebrow">Categorías</span>
        <div className="cc__arrows">
          <button className="cc__arrow" type="button" aria-label="Categoría anterior" onClick={() => api.current.go?.(-1)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5" /></svg>
          </button>
          <button className="cc__arrow" type="button" aria-label="Categoría siguiente" onClick={() => api.current.go?.(1)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 5.5 16 12l-6.5 6.5" /></svg>
          </button>
        </div>
      </div>

      <div className="cc__stage" ref={stageRef}>
        <div className="cc__track">
          {CATEGORIES.map((c, i) => (
            <article
              key={c.id}
              className="cc__card"
              ref={(el) => { cardRefs.current[i] = el; }}
              aria-label={c.title}
              aria-current={i === active}
              onClick={() => api.current.clickCard?.(i)}
            >
              {/* Acá se dibuja la prenda 3D (el canvas está encima de todas las tarjetas) */}
              <div className="cc__media" ref={(el) => { mediaRefs.current[i] = el; }} />
              <div className="cc__body">
                <span className="cc__index">{String(i + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}</span>
                <h3 className="cc__title">{c.title}</h3>
                <p className="cc__desc">{c.description}</p>
                <button
                  className="cc__more"
                  type="button"
                  tabIndex={i === active ? 0 : -1}
                  onClick={(e) => { e.stopPropagation(); onSelect?.(c.id); }}
                >
                  Ver más
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </button>
              </div>
            </article>
          ))}
        </div>
        <canvas ref={canvasRef} className="cc__canvas" aria-hidden="true" />
      </div>

      <div className="cc__dots">
        {CATEGORIES.map((c, i) => (
          <button
            key={c.id}
            type="button"
            className={`cc__dot${i === active ? ' is-active' : ''}`}
            aria-label={`Ir a ${c.title}`}
            aria-current={i === active}
            onClick={() => api.current.goTo?.(i)}
          />
        ))}
      </div>
    </section>
  );
}
