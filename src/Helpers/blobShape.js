// Geometría del "manchón": un contorno orgánico (cuadrado redondeado + ondulaciones) que se expande desde un punto.
// Todo está en coordenadas normalizadas (0 a 1) del recuadro del elemento, así sirve para cualquier tamaño.

const TAU = Math.PI * 2;
export const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;

export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// Sale rápido, se pasa un poquito y se acomoda (da el efecto "líquido")
export const easeOutBack = (t, s = 0.8) => {
  const c3 = s + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
};

/**
 * Puntos del contorno.
 *  progress: 0 = punto, 1 = manchón completo
 *  time: segundos (hace que el borde "respire")
 *  roundness: 2 = círculo, 4–5 = cuadrado redondeado (entra más contenido), más alto = más cuadrado
 *  size: qué parte del recuadro ocupa (0.94 deja un pequeño margen)
 *  wobble: cuánto se ondula el borde
 *  origin: de dónde nace, en coordenadas del recuadro ([1, 0.5] = borde derecho al medio)
 */
export function blobPoints({ progress, time = 0, roundness = 4.5, size = 0.94, wobble = 0.03, count = 44, origin = [0.5, 0.5] }) {
  const p = clamp01(progress);
  const center = easeInOutCubic(p);               // el centro viaja desde el origen hasta el medio
  const cx = lerp(origin[0], 0.5, center);
  const cy = lerp(origin[1], 0.5, center);
  const amp = wobble * (1 + 3 * Math.sin(Math.PI * p)); // en plena expansión se ondula más
  const points = [];

  for (let i = 0; i < count; i++) {
    const th = (i / count) * TAU;
    const c = Math.cos(th), s = Math.sin(th);
    // Cuadrado redondeado ("superelipse")
    const base = 0.5 * size * Math.pow(Math.pow(Math.abs(c), roundness) + Math.pow(Math.abs(s), roundness), -1 / roundness);
    // Ondulaciones lentas
    const noise =
      Math.sin(th * 2 + 1.3 + time * 0.9) * 0.5 +
      Math.sin(th * 3 + 4.1 - time * 0.7) * 0.35 +
      Math.sin(th * 5 + 2.2 + time * 1.3) * 0.15;
    // Cada lóbulo crece a su propio ritmo (unos van adelante y otros atrás), pero todos llegan juntos al final:
    // la mancha no crece pareja, como un líquido, y nunca se pellizca
    const pace = 1 + 0.35 * Math.sin(th * 2 + 0.7);
    const local = Math.pow(p, pace);
    const r = (base + noise * amp) * easeOutBack(local);
    points.push([cx + r * c, cy + r * s]);
  }
  return points;
}

// Une los puntos con curvas suaves (Catmull-Rom → Bézier) y devuelve el atributo `d` de un <path>
export function pointsToPath(pts) {
  const n = pts.length;
  const f = (v) => v.toFixed(4);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d}Z`;
}
