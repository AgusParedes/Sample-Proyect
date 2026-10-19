import { useEffect, useRef } from 'react';
import './HeroPixel.scss';
import logo from '../assets/logo-transparente.png';
import samplesWord from '../assets/samples-rojo.png';
import studioWord from '../assets/studio-rojo.png';

const RED = '#e51f26';
const BG = '#f8f8f8';
const TONES = ['#ffffff', '#fff0f0', '#ffe2e3']; // blancos casi idénticos: textura sutil

// ── Ajustes rápidos ──────────────────────────────────────────────
const CELLS_ACROSS = 120;   // más alto = píxeles más finos (más detalle)
const DISSOLVE_ZONE = 0.46; // % de altura del logo (desde arriba) que se va deshaciendo
const SIDE_SAFE = 0.06;     // margen lateral (0–0.5) que nunca se disuelve
const EMIT_RATE = 0.45;     // píxeles que salen por segundo, por cada píxel faltante
const MAX_PARTICLES = 900;
const NAME_DELAY_MS = 2600; // cuándo se abre el rectángulo (el logo termina de armarse ~2.3 s)
// ─────────────────────────────────────────────────────────────────

export default function HeroPixel() {
  const canvasRef = useRef(null);
  const nameRef = useRef(null);
  const restartRef = useRef(() => {});

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const image = new Image();
    image.src = logo;

    let width = 0, height = 0, dpr = 1;
    let step = 4, cell = 3, ox = 0, oy = 0;
    let pixels = [], emitters = [], loose = [], particles = [];
    let startTime = 0, lastNow = 0, spawnAcc = 0, frame = 0, disposed = false, nameTimer = 0;

    const rand = (min, max) => Math.random() * (max - min) + min;
    const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
    // Ruido determinista: el logo se ve igual aunque cambies el tamaño de ventana
    const hash = (c, r) => {
      const s = Math.sin(c * 127.1 + r * 311.7) * 43758.5453;
      return s - Math.floor(s);
    };

    function buildPixels() {
      if (!image.naturalWidth) return;
      const targetW = Math.min(width * 0.7, 560);
      const scale = Math.min(
        targetW / image.naturalWidth,
        Math.min(height * 0.34, 260) / image.naturalHeight
      );
      step = Math.max(3, Math.round((image.naturalWidth * scale) / CELLS_ACROSS));
      cell = step - 1; // 1px de separación entre píxeles = look de grilla nítida
      const cols = Math.round((image.naturalWidth * scale) / step);
      const rows = Math.round((image.naturalHeight * scale) / step);
      ox = Math.round(width / 2 - (cols * step) / 2);
      oy = Math.round(height * 0.49 - (rows * step) / 2);

      // Cada celda se muestrea con 4x4 puntos → bordes limpios, sin "manchas"
      const S = 4;
      const lc = document.createElement('canvas');
      lc.width = cols * S; lc.height = rows * S;
      const lctx = lc.getContext('2d', { willReadFrequently: true });
      lctx.imageSmoothingQuality = 'high';
      lctx.drawImage(image, 0, 0, lc.width, lc.height);
      const data = lctx.getImageData(0, 0, lc.width, lc.height).data;

      pixels = []; emitters = []; loose = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          let a = 0;
          for (let yy = 0; yy < S; yy++)
            for (let xx = 0; xx < S; xx++)
              a += data[((r * S + yy) * lc.width + (c * S + xx)) * 4 + 3];
          const cov = a / (S * S * 255);
          if (cov < 0.18) continue; // umbral bajo: conserva las puntas finas de las curvas

          const nx = (c + 0.5) / cols;
          const ny = (r + 0.5) / rows;
          // El borde de disolución ondula para que no sea una línea recta
          const wobble = Math.sin(nx * 9 + 1.3) * 0.045 + Math.sin(nx * 23 + 0.4) * 0.025;
          // Los costados quedan completos: la disolución solo actúa hacia el centro
          const sideGuard = clamp((Math.min(nx, 1 - nx) - SIDE_SAFE) / 0.14);
          const erosion = clamp((DISSOLVE_ZONE - (ny + wobble)) / DISSOLVE_ZONE) * sideGuard;
          const h = hash(c, r);
          const ready = 1.0 + (1 - ny) * 0.7 + 0.3;

          if (h < Math.pow(erosion, 0.9) * 0.97) {
            emitters.push({ c, r, ready });     // píxel que NO está en el logo: sale volando
          } else {
            const p = {
              c, r, ny,
              a: cov > 0.85 ? 1 : cov > 0.5 ? 0.8 : 0.6,
              tone: h > 0.9 ? 2 : h > 0.7 ? 1 : 0,
            };
            pixels.push(p);
            if (erosion > 0.12) loose.push({ c, r, ready });
          }
        }
      }
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth; height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildPixels();
      particles = [];
    }

    function scheduleName() {
      clearTimeout(nameTimer);
      const el = nameRef.current;
      if (!el) return;
      el.classList.remove('is-open');
      void el.offsetWidth; // fuerza reflow: la animación puede repetirse
      nameTimer = setTimeout(() => el.classList.add('is-open'), reduceMotion ? 0 : NAME_DELAY_MS);
    }

    function restart() {
      startTime = performance.now() - (reduceMotion ? 5000 : 0);
      lastNow = 0; spawnAcc = 0; particles = [];
      scheduleName();
    }
    restartRef.current = restart;

    function spawn(src) {
      const u = step / 4;
      particles.push({
        x: ox + src.c * step,
        y: oy + src.r * step,
        vx: rand(-10, 10) * u,
        vy: -rand(28, 120) * u,
        life: 0, max: rand(0.9, 2.3),
        phase: rand(0, Math.PI * 2),
        tone: Math.random() > 0.6 ? 1 : 0,
      });
    }

    function draw(now) {
      if (disposed) return;
      const dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0.016;
      lastNow = now;
      const elapsed = Math.max(0, (now - startTime) / 1000);

      ctx.fillStyle = BG; ctx.fillRect(0, 0, width, height);

      // Fondo rojo que se expande (igual que antes)
      const cx = width / 2, cy = height * 0.53;
      const progress = clamp(elapsed / 1.2);
      const radius = 5 + Math.hypot(width, height) * 0.72 * (1 - Math.pow(1 - progress, 3.2));
      ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();

      if (progress > 0.78 && pixels.length) {
        // Logo: se arma de abajo hacia arriba, píxel por píxel
        for (const p of pixels) {
          const delay = (1 - p.ny) * 1.0;
          const amount = clamp((elapsed - 1.0 - delay * 0.7) / 0.55);
          if (!amount) continue;
          const ease = 1 - Math.pow(1 - amount, 3);
          const s = cell * (0.55 + 0.45 * ease);
          const off = (cell - s) / 2;
          const x = ox + p.c * step + off;
          const y = oy + p.r * step + Math.round((1 - ease) * 4) * step + off;
          ctx.globalAlpha = p.a * Math.min(1, amount * 2.2);
          ctx.fillStyle = TONES[p.tone];
          ctx.fillRect(Math.round(x), Math.round(y), s, s);
        }
        ctx.globalAlpha = 1;

        // Los píxeles "faltantes" del tope salen volando
        if (!reduceMotion && elapsed > 1.3 && emitters.length) {
          const boost = elapsed < 2.8 ? 2.2 : 1;
          spawnAcc += emitters.length * EMIT_RATE * boost * dt;
          while (spawnAcc >= 1 && particles.length < MAX_PARTICLES) {
            spawnAcc -= 1;
            const pool = Math.random() < 0.2 && loose.length ? loose : emitters;
            for (let t = 0; t < 3; t++) {
              const src = pool[(Math.random() * pool.length) | 0];
              if (elapsed > src.ready) { spawn(src); break; }
            }
          }
          if (spawnAcc > 4) spawnAcc = 0;
        }

        const u = step / 4;
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.life += dt;
          const t = p.life / p.max;
          if (t >= 1) { particles.splice(i, 1); continue; }
          p.x += (p.vx + Math.sin(p.life * 3 + p.phase) * 14 * u + 8 * u) * dt;
          p.y += p.vy * dt;
          // Se pegan a la grilla del logo → se siente pixel-art, no confeti
          const gx = ox + Math.round((p.x - ox) / step) * step;
          const gy = oy + Math.round((p.y - oy) / step) * step;
          const s = t < 0.55 ? cell : t < 0.8 ? Math.max(1, cell * 0.66) : Math.max(1, cell * 0.4);
          const off = (cell - s) / 2;
          ctx.globalAlpha = Math.pow(1 - t, 1.2);
          ctx.fillStyle = TONES[p.tone];
          ctx.fillRect(Math.round(gx + off), Math.round(gy + off), s, s);
        }
        ctx.globalAlpha = 1;
      }
      frame = requestAnimationFrame(draw);
    }

    image.onload = () => { resize(); restart(); frame = requestAnimationFrame(draw); };
    window.addEventListener('resize', resize);
    return () => {
      disposed = true;
      clearTimeout(nameTimer);
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section className="hero-pixel">
      <canvas ref={canvasRef} className="hero-pixel__canvas" aria-label="Logo construyéndose con píxeles" />
      <h1 className="hero-pixel__name" ref={nameRef} aria-label="Samples Studio">
        <span className="hero-pixel__word" style={{ '--d': '.75s' }}>
          <img src={samplesWord} alt="" draggable="false" />
        </span>
        <span className="hero-pixel__word" style={{ '--d': '.93s' }}>
          <img src={studioWord} alt="" draggable="false" />
        </span>
      </h1>
      <button className="hero-pixel__replay" type="button" onClick={() => restartRef.current()}>
        Repetir animación ↻
      </button>
      <span className="hero-pixel__hint" aria-hidden="true">Pixel ignition / identity in motion</span>
    </section>
  );
}
