import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Herramientas para armar prendas "inflables": una silueta 2D que se extruye con bordes bien redondeados.
// Todas las medidas son unidades 3D; cada prenda se escala sola al final (fitModel).

export const v2 = (pts) => pts.map(([x, y]) => new THREE.Vector2(x, y));

// Curva Bézier muestreada en n puntos (sin el punto de partida)
export function bez(p0, c1, c2, p3, n = 8) {
  const pts = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    pts.push([
      u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1],
    ]);
  }
  return pts;
}

// La mitad derecha (de arriba al centro hasta abajo al centro) → silueta completa, simétrica
export function symmetric(half) {
  const left = half.slice(1, -1).map(([x, y]) => [-x, y]).reverse();
  return [...half, ...left];
}

export function ellipse(cx, cy, rx, ry, n = 48) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
  });
}

// Polígono con las esquinas redondeadas
export function roundedShape(points, r = 0.07) {
  const pts = points.filter((p, i) => {
    const q = points[(i + 1) % points.length];
    return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6;
  });
  const n = pts.length;
  const shape = new THREE.Shape();
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const ax = p0[0] - p1[0], ay = p0[1] - p1[1];
    const bx = p2[0] - p1[0], by = p2[1] - p1[1];
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    const da = Math.min(r, la * 0.5), db = Math.min(r, lb * 0.5);
    const sx = p1[0] + (ax / la) * da, sy = p1[1] + (ay / la) * da;
    const ex = p1[0] + (bx / lb) * db, ey = p1[1] + (by / lb) * db;
    if (i === 0) shape.moveTo(sx, sy); else shape.lineTo(sx, sy);
    shape.quadraticCurveTo(p1[0], p1[1], ex, ey);
  }
  shape.closePath();
  return shape;
}

// Silueta → volumen con bordes redondeados (el contorno final es el de la silueta).
// bevel: qué tan "inflado" queda. Tiene que ser menor que la mitad del ancho de la pieza más fina.
export function puffy(shape, { depth = 0.06, bevel = 0.09, segments = 6 } = {}) {
  const raw = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel,
    bevelSegments: segments, curveSegments: 6,
  });
  raw.translate(0, 0, -depth / 2);
  const smooth = toCreasedNormals(raw, 0.6); // normales suaves: brillo continuo, sin facetas
  raw.dispose();
  return smooth;
}

// Centra la prenda y la escala para que todas midan parecido
export function fitModel(model, size = 2.4) {
  const box = new THREE.Box3().setFromObject(model);
  const c = box.getCenter(new THREE.Vector3());
  const s = box.getSize(new THREE.Vector3());
  const k = size / Math.max(s.y, s.x * 0.85);
  model.position.set(-c.x, -c.y, -c.z);
  const pivot = new THREE.Group();
  pivot.add(model);
  pivot.scale.setScalar(k);
  return pivot;
}
