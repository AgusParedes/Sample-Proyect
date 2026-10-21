import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import './HeroPixel.scss'; // mismo SCSS que el HeroPixel actual
import logo from '../../assets/logo-transparente.png';

const BACKGROUND = 0x000000; // color de fondo del hero (0xe51f26 = el rojo de antes)
const ACCENT = 0x9b9b9b;     // rojo de la marca (se usa en el reflejo del borde)
const TONES = [0xffffff, 0xfff0f0, 0xffe2e3]; // blancos casi idénticos: textura sutil

// ── Ajustes rápidos ──────────────────────────────────────────────
// Logo 3D brillante
const THICKNESS = 0.05;     // grosor como fracción del ancho del logo
const BEVEL = 0.3;          // redondeo de los bordes (0 = filo, 0.5 = muy redondeado)
const ROUGHNESS = 0.2;      // 0 = espejo, 0.5 = plástico mate
const GLINT = 6;            // brillo del destello de luz que cruza el logo (0 = sin destello)
const RIM = 1.4;            // reflejo rojo en los bordes (0 = sin reflejo)
// Animación
const FLY_FROM = 0.42;      // desde qué cercanía a la cámara arranca (0.2 = lejos, 0.6 = muy cerca)
const FLY_TIME = 1.6;       // segundos desde que aparece hasta que se estampa
const SPIN_TURNS = 1.25;    // vueltas que da antes de pegar
const PRESS_TIME = 0.12;    // lo que tarda el logo brillante en aplastarse contra el fondo
const SHAKE = 7;            // temblor de cámara al impactar, en px
// Logo pixelado (el que queda)
const CELLS_ACROSS = 120;   // píxeles del logo: más alto = más detalle
const DISSOLVE_ZONE = 0.46; // parte de arriba del logo que queda incompleta
const SIDE_SAFE = 0.06;     // margen lateral que nunca se disuelve
const STAMP_SPREAD = 0.14;  // cuánto tarda la aparición de píxeles en ir del centro a las puntas
// Ola de píxeles
const WAVE_TIME = 2.4;      // segundos que dura la ola hasta apagarse (después no queda ningún píxel)
const WAVE_SPEED = 0.75;    // velocidad del frente: 0.5 = lenta, 1.2 = muy rápida
const WAVE_CELL = 3;        // tamaño de los píxeles de la ola (múltiplo de los del logo)
const WAVE_RIPPLE = 62;     // separación (px) entre las ondas que siguen al frente
const WAVE_STRENGTH = 1.7;  // intensidad general (subila si la querés más fuerte)
const WAVE_PUSH = 6;        // cuánto empuja los píxeles hacia afuera al pasar (px)
const WAVE_DELAY = 0.08;    // retraso respecto al impacto, para que nazca desde el borde del logo
// Fuego: los píxeles que "faltan" arriba del logo salen volando
const FIRE_RATE = 0.45;     // píxeles que salen por segundo, por cada píxel faltante
const FIRE_START = 0.35;    // segundos después del impacto en que empieza
const FIRE_RED = 0.2;       // proporción de brasas rojas (0 = todo blanco)
const MAX_FIRE = 700;       // máximo de píxeles volando a la vez
// Header
const NAME_AT = FLY_TIME + WAVE_TIME - 0.3; // segundos en que se considera "terminó la animación" (aparece el nombre)
// ─────────────────────────────────────────────────────────────────

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
// Ruido determinista: el logo se ve igual aunque cambies el tamaño de ventana
const hash = (c, r) => {
  const s = Math.sin(c * 127.1 + r * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/* ── Contorno del PNG → formas 3D ───────────────────────────────────
   Marching squares sobre el canal alpha: recorre el borde del logo con
   precisión de subpíxel y devuelve lazos cerrados (contornos y huecos). */
function traceContours(alpha, W, H, thr = 0.5) {
  const v = (x, y) => (x < 1 || y < 1 || x > W || y > H ? 0 : alpha[(y - 1) * W + (x - 1)]);
  const adj = new Map();
  const pos = new Map();
  const link = (a, b) => { (adj.get(a) || adj.set(a, []).get(a)).push(b); };
  const seg = (a, b) => { link(a[0], b[0]); link(b[0], a[0]); pos.set(a[0], a[1]); pos.set(b[0], b[1]); };

  for (let y = 0; y <= H; y++) {
    for (let x = 0; x <= W; x++) {
      const tl = v(x, y), tr = v(x + 1, y), br = v(x + 1, y + 1), bl = v(x, y + 1);
      const idx = (tl >= thr ? 1 : 0) | (tr >= thr ? 2 : 0) | (br >= thr ? 4 : 0) | (bl >= thr ? 8 : 0);
      if (idx === 0 || idx === 15) continue;
      const T = () => [`h${x},${y}`, { x: x + (thr - tl) / (tr - tl), y }];
      const R = () => [`v${x + 1},${y}`, { x: x + 1, y: y + (thr - tr) / (br - tr) }];
      const B = () => [`h${x},${y + 1}`, { x: x + (thr - bl) / (br - bl), y: y + 1 }];
      const L = () => [`v${x},${y}`, { x, y: y + (thr - tl) / (bl - tl) }];
      switch (idx) {
        case 1: case 14: seg(L(), T()); break;
        case 2: case 13: seg(T(), R()); break;
        case 3: case 12: seg(L(), R()); break;
        case 4: case 11: seg(R(), B()); break;
        case 6: case 9: seg(T(), B()); break;
        case 7: case 8: seg(L(), B()); break;
        case 5: seg(L(), T()); seg(R(), B()); break;
        case 10: seg(T(), R()); seg(L(), B()); break;
        default: break;
      }
    }
  }

  const loops = [];
  const seen = new Set();
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const loop = [];
    let cur = start;
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      loop.push(pos.get(cur));
      cur = adj.get(cur).find((n) => !seen.has(n));
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const a = pts[0], b = pts[pts.length - 1];
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  let max = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(dy * pts[i].x - dx * pts[i].y + b.x * a.y - b.y * a.x) / len;
    if (d > max) { max = d; idx = i; }
  }
  if (max <= eps) return [a, b];
  return [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)];
}

// Un lazo cerrado se parte en dos tramos (inicio → punto más lejano → inicio) para simplificarlo
function simplifyLoop(loop, eps) {
  let k = 0, best = 0;
  for (let i = 1; i < loop.length; i++) {
    const d = Math.hypot(loop[i].x - loop[0].x, loop[i].y - loop[0].y);
    if (d > best) { best = d; k = i; }
  }
  const first = rdp(loop.slice(0, k + 1), eps);
  const second = rdp([...loop.slice(k), loop[0]], eps);
  return [...first.slice(0, -1), ...second.slice(0, -1)];
}

function polyArea(p) {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += p[j].x * p[i].y - p[i].x * p[j].y;
  return a / 2;
}

function pointInPoly(pt, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

// Lazos → THREE.Shape con sus huecos (por anidamiento: par = contorno, impar = hueco)
function loopsToShapes(loops, toWorld) {
  const info = loops
    .map((poly) => ({ poly, area: Math.abs(polyArea(poly)) }))
    .filter((l) => l.area > 4);
  info.forEach((l, i) => {
    const containers = [];
    info.forEach((o, j) => { if (j !== i && pointInPoly(l.poly[0], o.poly)) containers.push(j); });
    l.depth = containers.length;
    l.parent = containers.sort((a, b) => info[a].area - info[b].area)[0] ?? -1;
  });
  const shapes = [];
  const shapeOf = new Map();
  info.forEach((l, i) => {
    if (l.depth % 2) return;
    const s = new THREE.Shape(l.poly.map(toWorld));
    shapeOf.set(i, s);
    shapes.push(s);
  });
  info.forEach((l) => {
    if (l.depth % 2 && shapeOf.has(l.parent)) shapeOf.get(l.parent).holes.push(new THREE.Path(l.poly.map(toWorld)));
  });
  return shapes;
}

/* ── Ola ─────────────────────────────────────────────────────────────
   Grilla de píxeles que cubre toda la pantalla. Cada uno guarda su distancia al
   borde del logo; el frente de la onda avanza y frena, y detrás deja ondas que
   se van apagando. El resultado de cada píxel se redondea a 4 niveles (look pixelado). */
function makeWaveCells(width, height, halfW, halfH, wstep) {
  const a = halfW + 16, b = halfH + 16; // elipse del logo + margen: ahí adentro no hay ola
  const ncols = Math.ceil(width / wstep) + 4;
  const nrows = Math.ceil(height / wstep) + 4;
  const cells = [];
  let maxDist = 1;
  for (let r = 0; r < nrows; r++) {
    for (let c = 0; c < ncols; c++) {
      const x = (c - (ncols - 1) / 2) * wstep;
      const y = (r - (nrows - 1) / 2) * wstep;
      const rho = Math.hypot(x, y) || 0.001;
      const rEll = (a * b) / Math.hypot((b * x) / rho, (a * y) / rho);
      const dist = rho - rEll; // distancia (en línea recta desde el centro) al borde del logo
      if (dist <= 0) continue;
      maxDist = Math.max(maxDist, dist);
      cells.push({ x, y, ux: x / rho, uy: y / rho, dist, rnd: hash(c + 7, r + 13) });
    }
  }
  return { cells, maxDist };
}

// Devuelve la intensidad "h" de la ola en un píxel (0 = quieto)
function waveHeight(dist, front, decay, fade) {
  const s = front - dist; // cuánto pasó el frente por este píxel
  if (s <= 0) return 0;
  const ramp = 1 - Math.exp(-s / 6);                       // frente nítido
  const trail = Math.exp(-s / 95);                         // estela corta: detrás del frente se va limpiando
  const ripple = 0.25 + 0.75 * (0.5 + 0.5 * Math.cos((s * 2 * Math.PI) / WAVE_RIPPLE)); // ondas detrás del frente
  const reach = Math.pow(1 + dist / 240, -0.6);            // pierde fuerza con la distancia
  const crest = 1 + 0.8 * Math.exp(-s / 22);               // el borde del frente se mantiene más claro
  return ramp * trail * ripple * reach * crest * decay * fade * WAVE_STRENGTH;
}

// onIntroStart / onIntroDone: avisan cuándo arranca y cuándo termina la animación inicial
// (también al tocar "Repetir animación").
export default function HeroPixel3D({ onIntroStart, onIntroDone }) {
  const canvasRef = useRef(null);
  const scrollRef = useRef(null);
  const callbacks = useRef({});
  callbacks.current = { onIntroStart, onIntroDone };

  useEffect(() => {
    const canvas = canvasRef.current;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const image = new Image();
    image.src = logo;

    // 1 unidad de Three.js = 1 px de pantalla en el plano del fondo (z = 0).
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setClearColor(BACKGROUND);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 10, 10000);

    // Reflejos de "estudio": sin esto el brillo no se nota. No necesita ningún archivo.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
    scene.environment = envTex;
    scene.add(new THREE.AmbientLight(0xffffff, 0.25));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-0.5, 0.7, 1);
    scene.add(sun);

    // Destello: una luz que cruza el logo mientras viene hacia el fondo
    // (decay 0 = no pierde fuerza con la distancia)
    const glint = new THREE.PointLight(0xffffff, 0, 0, 0);
    scene.add(glint);
    // Reflejo rojo desde atrás: dibuja los bordes del logo cuando gira
    const rim = new THREE.DirectionalLight(ACCENT, RIM);
    rim.position.set(0.9, -0.3, -1);
    scene.add(rim);

    const glossMat = new THREE.MeshPhysicalMaterial({
      color: 0xf4f4f4, metalness: 0, roughness: ROUGHNESS,
      clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.1,
    });
    const pixelMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    const waveMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    const white = new THREE.Color(0xffffff);
    const waveCol = new THREE.Color();
    const fireCol = new THREE.Color();
    const fireWhite = new THREE.Color(0xffffff);
    const fireRed = new THREE.Color(ACCENT);

    const group = new THREE.Group();   // vuelo y giro del logo brillante
    scene.add(group);
    const dummy = new THREE.Object3D();
    const bgColor = new THREE.Color(BACKGROUND);

    let width = 0, height = 0, camDist = 1, half = 0;
    let glossy = null, pixelMesh = null, items = [];
    let waveMesh = null, waveCells = [], waveMax = 1, needsWaveWrite = true;
    let fireMesh = null, fireSrc = [], fireLoose = [], fire = [], fireAcc = 0;
    let fireStep = 4, fireXo = 0, fireYo = 0, lastNow = 0;
    let startTime = 0, frame = 0, disposed = false, introTimer = 0, curDpr = 0, onScreen = true;
    let needsWrite = true, drawnFinal = false;

    function disposeLogo() {
      if (glossy) { group.remove(glossy); glossy.geometry.dispose(); glossy = null; }
      if (pixelMesh) { scene.remove(pixelMesh); pixelMesh.geometry.dispose(); pixelMesh.dispose(); pixelMesh = null; }
      if (waveMesh) { scene.remove(waveMesh); waveMesh.geometry.dispose(); waveMesh.dispose(); waveMesh = null; }
      if (fireMesh) { scene.remove(fireMesh); fireMesh.geometry.dispose(); fireMesh.dispose(); fireMesh = null; }
      fire = [];
    }

    function buildLogo() {
      if (!image.naturalWidth) return;
      disposeLogo();

      const W = image.naturalWidth, H = image.naturalHeight;
      const targetW = Math.min(width * 0.7, 560);
      const scale = Math.min(targetW / W, Math.min(height * 0.34, 260) / H);

      const lc = document.createElement('canvas');
      lc.width = W; lc.height = H;
      const lctx = lc.getContext('2d', { willReadFrequently: true });
      lctx.drawImage(image, 0, 0);
      const px = lctx.getImageData(0, 0, W, H).data;

      // ── 1) Logo brillante: contorno exacto del PNG, extruido con bordes redondeados ──
      const alpha = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) alpha[i] = px[i * 4 + 3] / 255;
      const loops = traceContours(alpha, W, H).map((l) => simplifyLoop(l, 0.3));
      const toWorld = (p) => new THREE.Vector2((p.x - 1 + 0.5 - W / 2) * scale, -(p.y - 1 + 0.5 - H / 2) * scale);
      const shapes = loopsToShapes(loops, toWorld);

      const depth = W * scale * THICKNESS;
      const bevelT = depth * BEVEL, bevelS = depth * BEVEL * 0.75;
      let geo = new THREE.ExtrudeGeometry(shapes, {
        depth, bevelEnabled: true, bevelThickness: bevelT, bevelSize: bevelS,
        bevelOffset: -bevelS * 0.6, bevelSegments: 5, curveSegments: 1,
      });
      geo.translate(0, 0, bevelT); // la cara de atrás queda justo en el fondo (z = 0)
      const smooth = toCreasedNormals(geo, 0.6); // normales suaves → brillo continuo, sin facetas
      geo.dispose();
      geo = smooth;
      half = (depth + bevelT * 2) / 2;
      glossy = new THREE.Mesh(geo, glossMat);
      group.add(glossy);

      // ── 2) Logo pixelado: mismo cálculo que el 2D de siempre (tope incompleto) ──
      const step = Math.max(3, Math.round((W * scale) / CELLS_ACROSS));
      const cell = step - 1;
      const cols = Math.round((W * scale) / step);
      const rows = Math.round((H * scale) / step);
      const S = 4;
      const pc = document.createElement('canvas');
      pc.width = cols * S; pc.height = rows * S;
      const pctx = pc.getContext('2d', { willReadFrequently: true });
      pctx.imageSmoothingQuality = 'high';
      pctx.drawImage(image, 0, 0, pc.width, pc.height);
      const data = pctx.getImageData(0, 0, pc.width, pc.height).data;

      items = [];
      fireSrc = []; fireLoose = [];
      let maxR = 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          let a = 0;
          for (let yy = 0; yy < S; yy++)
            for (let xx = 0; xx < S; xx++)
              a += data[((r * S + yy) * pc.width + (c * S + xx)) * 4 + 3];
          const cov = a / (S * S * 255);
          if (cov < 0.18) continue;

          const nx = (c + 0.5) / cols;
          const ny = (r + 0.5) / rows;
          const wobble = Math.sin(nx * 9 + 1.3) * 0.045 + Math.sin(nx * 23 + 0.4) * 0.025;
          const sideGuard = clamp((Math.min(nx, 1 - nx) - SIDE_SAFE) / 0.14);
          const erosion = clamp((DISSOLVE_ZONE - (ny + wobble)) / DISSOLVE_ZONE) * sideGuard;
          const h = hash(c, r);
          const x = c * step + step / 2 - (cols * step) / 2;
          const y = -(r * step + step / 2 - (rows * step) / 2);
          if (h < Math.pow(erosion, 0.9) * 0.97) { fireSrc.push({ x, y }); continue; } // píxel "faltante": de acá sale el fuego
          if (erosion > 0.12) fireLoose.push({ x, y });
          maxR = Math.max(maxR, Math.hypot(x, y));
          items.push({
            x, y, d: Math.hypot(x, y),
            a: cov > 0.85 ? 1 : cov > 0.5 ? 0.8 : 0.6,
            tone: h > 0.9 ? 2 : h > 0.7 ? 1 : 0,
          });
        }
      }
      for (const it of items) it.dn = it.d / maxR; // 0 = centro, 1 = punta más lejana

      pixelMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(cell, cell), pixelMat, items.length);
      pixelMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const col = new THREE.Color();
      items.forEach((it, i) => {
        col.set(TONES[it.tone]).lerp(bgColor, (1 - it.a) * 0.85); // bordes mezclados con el fondo
        pixelMesh.setColorAt(i, col);
      });
      pixelMesh.position.set(0, height * 0.01, 0.5);
      scene.add(pixelMesh);
      needsWrite = true;

      // ── 3) Ola: grilla de píxeles de toda la pantalla, centrada en el logo ──
      const wstep = Math.max(8, step * WAVE_CELL);
      const built = makeWaveCells(width, height, (cols * step) / 2, (rows * step) / 2, wstep);
      waveCells = built.cells;
      waveMax = built.maxDist;
      waveMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(wstep - 2, wstep - 2), waveMat, waveCells.length);
      waveMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < waveCells.length; i++) waveMesh.setColorAt(i, bgColor);
      waveMesh.position.set(0, height * 0.01, 0.2); // detrás de los píxeles del logo
      scene.add(waveMesh);
      needsWaveWrite = true;

      // ── 4) Fuego: píxeles que suben desde el tope incompleto del logo ──
      fireStep = step;
      fireXo = step / 2 - (cols * step) / 2;
      fireYo = -(step / 2 - (rows * step) / 2);
      fireMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(cell, cell), pixelMat, MAX_FIRE);
      fireMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < MAX_FIRE; i++) fireMesh.setColorAt(i, bgColor);
      fireMesh.count = 0;
      fireMesh.position.set(0, height * 0.01, 0.6); // por encima del logo pixelado
      scene.add(fireMesh);
      for (const m of [pixelMesh, waveMesh, fireMesh]) m.frustumCulled = false;
    }

    // Los píxeles "se estampan": aparecen desde el centro hacia afuera
    function writePixels(elapsed) {
      if (!pixelMesh) return;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const t = clamp((elapsed - FLY_TIME - it.dn * STAMP_SPREAD) / 0.22);
        const s = t <= 0 ? 0 : easeOut(t);
        dummy.position.set(it.x, it.y, 0);
        dummy.scale.set(s, s, 1);
        dummy.updateMatrix();
        pixelMesh.setMatrixAt(i, dummy.matrix);
      }
      pixelMesh.instanceMatrix.needsUpdate = true;
    }

    // tau = segundos desde que nace la ola (<= 0: todo apagado)
    function writeWave(tau) {
      if (!waveMesh) return;
      const front = tau <= 0 ? -1 : waveMax * 1.1 * (1 - Math.exp(-(tau * WAVE_SPEED) / 0.55)); // arranca muy rápido y va frenando
      const x = clamp((tau - (WAVE_TIME - 0.9)) / 0.9);
      const fade = 1 - x * x * (3 - 2 * x);                    // se apaga por completo hacia el final
      const decay = Math.exp(-Math.max(0, tau) / 3);
      const shim = Math.floor(Math.max(0, tau) * 14) * 0.618;  // titileo leve de los píxeles
      for (let i = 0; i < waveCells.length; i++) {
        const c = waveCells[i];
        const h = tau <= 0 ? 0 : waveHeight(c.dist, front, decay, fade);
        const v = h + (((c.rnd + shim) % 1) - 0.5) * 0.28;      // dispersión: el borde se deshace en píxeles sueltos
        const q = v <= 0.14 ? 0 : Math.min(1, Math.round(v * 3) / 3); // 3 niveles; lo débil se apaga del todo
        if (q === 0) {
          dummy.position.set(c.x, c.y, 0);
          dummy.scale.set(0, 0, 1);
        } else {
          const k = 0.4 + 0.6 * q;
          const push = h * WAVE_PUSH;                           // los píxeles se empujan hacia afuera y saltan
          dummy.position.set(c.x + c.ux * push, c.y + c.uy * push, Math.min(h, 1.5) * 6);
          dummy.scale.set(k, k, 1);
          waveCol.copy(bgColor).lerp(white, q);
          waveMesh.setColorAt(i, waveCol);
        }
        dummy.updateMatrix();
        waveMesh.setMatrixAt(i, dummy.matrix);
      }
      waveMesh.instanceMatrix.needsUpdate = true;
      if (waveMesh.instanceColor) waveMesh.instanceColor.needsUpdate = true;
    }

    // Fuego: cada píxel nace en un lugar "faltante" del logo, sube con un vaivén, se achica y se apaga
    function updateFire(dt, since) {
      if (!fireMesh) return;
      const u = fireStep / 4;
      if (!reduceMotion && since > FIRE_START && fireSrc.length) {
        const boost = since < FIRE_START + 1.4 ? 2.2 : 1; // más intenso justo después del impacto
        fireAcc += fireSrc.length * FIRE_RATE * boost * dt;
        while (fireAcc >= 1 && fire.length < MAX_FIRE) {
          fireAcc -= 1;
          const pool = Math.random() < 0.2 && fireLoose.length ? fireLoose : fireSrc;
          const a = pool[(Math.random() * pool.length) | 0];
          const b = pool[(Math.random() * pool.length) | 0];
          const src = a.y > b.y ? a : b; // sesgo hacia los de más arriba
          fire.push({
            x: src.x, y: src.y,
            vx: (Math.random() - 0.5) * 20 * u,
            vy: (28 + Math.random() * 92) * u,
            life: 0, max: 0.9 + Math.random() * 1.4,
            phase: Math.random() * Math.PI * 2,
            red: Math.random() < FIRE_RED,
            tone: Math.random() > 0.6 ? 0.9 : 1,
          });
        }
        if (fireAcc > 4) fireAcc = 0;
      }

      for (let i = fire.length - 1; i >= 0; i--) {
        const p = fire[i];
        p.life += dt;
        if (p.life >= p.max) { fire[i] = fire[fire.length - 1]; fire.pop(); continue; }
        p.vy *= 1 + 0.35 * dt;                                   // acelera al subir
        p.vx += -p.x * 0.25 * dt;                                // se junta hacia el centro: forma de llama
        p.x += (p.vx + Math.sin(p.life * 3 + p.phase) * 14 * u) * dt;
        p.y += p.vy * dt;
      }

      for (let i = 0; i < fire.length; i++) {
        const p = fire[i];
        const t = p.life / p.max;
        const gx = fireXo + Math.round((p.x - fireXo) / fireStep) * fireStep; // pegados a la grilla del logo
        const gy = fireYo + Math.round((p.y - fireYo) / fireStep) * fireStep;
        const sc = t < 0.5 ? 1 : t < 0.8 ? 0.66 : 0.4;
        dummy.position.set(gx, gy, 0);
        dummy.scale.set(sc, sc, 1);
        dummy.updateMatrix();
        fireMesh.setMatrixAt(i, dummy.matrix);
        const k = clamp(1 - Math.pow(t, 1.4)) * (0.8 + 0.2 * Math.sin(p.life * 38 + p.phase)); // titila y se apaga
        fireCol.copy(bgColor).lerp(p.red ? fireRed : fireWhite, k * p.tone);
        fireMesh.setColorAt(i, fireCol);
      }
      fireMesh.count = fire.length;
      fireMesh.instanceMatrix.needsUpdate = true;
      if (fireMesh.instanceColor) fireMesh.instanceColor.needsUpdate = true;
    }

    // Solo se reconstruye si el tamaño del canvas cambió de verdad. En el celular, la barra del
    // navegador aparece y desaparece al cambiar la dirección del scroll y dispara eventos de resize.
    function resize(force = false) {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const d = Math.min(window.devicePixelRatio || 1, 2);
      if (!force && w === width && h === height && d === curDpr) return;
      curDpr = d;
      width = w; height = h;
      renderer.setPixelRatio(d);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camDist = height / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      camera.far = camDist * 4;
      camera.updateProjectionMatrix();
      group.position.y = height * 0.01;
      buildLogo();
      drawnFinal = false;
    }

    function restart() {
      startTime = performance.now() - (reduceMotion ? 6000 : 0);
      needsWrite = true; needsWaveWrite = true; drawnFinal = false;
      fire = []; fireAcc = 0; lastNow = 0;
      if (fireMesh) fireMesh.count = 0;
      clearTimeout(introTimer);
      scrollRef.current?.classList.remove('is-visible');
      callbacks.current.onIntroStart?.();
      introTimer = setTimeout(() => {
        callbacks.current.onIntroDone?.();
        scrollRef.current?.classList.add('is-visible');
      }, reduceMotion ? 0 : NAME_AT * 1000);
    }

    function tick(now) {
      if (disposed) return;
      // Mientras el hero no está en pantalla no se dibuja: deja todo el rendimiento al gusano
      if (!onScreen) { lastNow = 0; frame = requestAnimationFrame(tick); return; }
      const t = Math.max(0, (now - startTime) / 1000);
      const since = t - FLY_TIME;
      const END = FLY_TIME + WAVE_TIME + 0.2;
      const dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0.016;
      lastNow = now;

      // Con "reducir movimiento" queda todo quieto: no hace falta seguir dibujando
      if (reduceMotion && t > END && drawnFinal) { frame = requestAnimationFrame(tick); return; }

      // 1) Logo brillante: viene desde la cámara hacia el fondo, girando y acelerando
      if (glossy) {
        if (since < PRESS_TIME) {
          const p = clamp(t / FLY_TIME);
          const appear = easeOut(clamp(t / 0.35));
          const spin = easeOut(clamp(p / 0.92)); // termina de girar justo antes de pegar
          group.position.z = camDist * FLY_FROM * (1 - p * p * p);
          group.rotation.set((1 - spin) * 0.5, -(1 - spin) * Math.PI * 2 * SPIN_TURNS, -(1 - spin) * 0.15);
          group.scale.setScalar(0.35 + 0.65 * appear);
          glossy.position.z = -half * (1 - spin); // gira sobre su centro; al llegar, la cara de atrás toca el fondo
          // 2) Impacto: se aplasta contra el fondo y desaparece
          glossy.scale.z = since > 0 ? Math.max(0.001, 1 - easeOut(clamp(since / PRESS_TIME))) : 1;
          glossy.visible = true;

          // Destello: la luz barre de izquierda a derecha y se apaga al pegar
          const gp = clamp((t - FLY_TIME * 0.35) / (FLY_TIME * 0.65));
          glint.position.set((gp - 0.5) * width * 0.9, height * 0.18, camDist * 0.25);
          glint.intensity = GLINT * Math.pow(Math.sin(Math.PI * gp), 0.8);
        } else {
          glossy.visible = false;
          glint.intensity = 0;
        }
      }

      // 3) …y en su lugar aparecen los píxeles
      if (since < 0) {
        if (needsWrite) { writePixels(-1); needsWrite = false; }
      } else if (since < 0.6) {
        writePixels(t); needsWrite = true;
      } else if (needsWrite) {
        writePixels(t); needsWrite = false;
      }

      // 4) El impacto lanza una ola de píxeles blancos que recorre toda la pantalla
      if (reduceMotion || since < 0) {
        if (needsWaveWrite) { writeWave(-1); needsWaveWrite = false; }
      } else if (since < WAVE_TIME) {
        writeWave(since - WAVE_DELAY); needsWaveWrite = true;
      } else if (needsWaveWrite) {
        writeWave(WAVE_TIME + 1); needsWaveWrite = false;
      }

      // 5) Fuego en el tope del logo (sigue indefinidamente)
      updateFire(dt, since);

      // 6) Golpe de cámara: temblor + un pequeño empujón hacia el fondo
      let ox = 0, oy = 0, oz = 0;
      if (since > 0 && since < 0.5) {
        const k = Math.pow(1 - since / 0.5, 2);
        ox = Math.sin(since * 95) * SHAKE * k;
        oy = Math.cos(since * 77) * SHAKE * 0.7 * k;
        oz = -Math.sin(Math.PI * clamp(since / 0.25)) * 18;
      }
      camera.position.set(ox, oy, camDist + oz);

      renderer.render(scene, camera);
      if (t > END) drawnFinal = true;
      frame = requestAnimationFrame(tick);
    }

    image.onload = () => { resize(true); restart(); frame = requestAnimationFrame(tick); };
    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(canvas);
    const visibility = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; });
    visibility.observe(canvas);
    // "Scroll down" desaparece apenas se empieza a scrollear
    const onScroll = () => scrollRef.current?.classList.toggle('is-scrolled', window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      disposed = true;
      clearTimeout(introTimer);
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibility.disconnect();
      window.removeEventListener('scroll', onScroll);
      disposeLogo();
      glossMat.dispose(); pixelMat.dispose(); waveMat.dispose();
      envTex.dispose(); pmrem.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <section className="hero-pixel">
      <canvas ref={canvasRef} className="hero-pixel__canvas" aria-label="Logo en 3D estampándose contra el fondo" />
      <div className="hero-pixel__scroll" ref={scrollRef} aria-hidden="true">
        <span className="hero-pixel__scroll-text">Scroll down</span>
        <span className="hero-pixel__scroll-line"><i /></span>
      </div>
    </section>
  );
}
