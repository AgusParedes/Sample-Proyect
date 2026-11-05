import * as THREE from 'three';
import { bez, symmetric, roundedShape, puffy } from './shapes.js';

// Remera (versión armada en código). Para usar tu TShirt3D de antes, reemplazá esta función en garments/index.js.
export function buildTShirt({ cloth, detail }) {
  const g = new THREE.Group();

  // Cuello: curva desde el centro hasta el hombro
  const neck = bez([0, 0.78], [0.2, 0.78], [0.4, 0.86], [0.42, 1.12], 8);
  const half = [
    [0, 0.78], ...neck,
    [1.0, 0.95],   // hombro
    [1.42, 0.4],   // manga, punta de afuera
    [1.14, 0.14],  // manga, punta de adentro
    [0.82, 0.3],   // axila
    [0.82, -1.15], // costado hasta el ruedo
    [0, -1.15],
  ];
  g.add(new THREE.Mesh(puffy(roundedShape(symmetric(half), 0.07), { bevel: 0.09 }), cloth));

  // Cuello de la remera: una tira fina siguiendo la curva
  const right = [[0, 0.78], ...neck];
  const left = right.slice(1).reverse().map(([x, y]) => [-x, y]);
  const path = [...left, ...right].map(([x, y]) => new THREE.Vector3(x, y - 0.07, 0.115));
  const collar = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path), 48, 0.032, 8, false);
  g.add(new THREE.Mesh(collar, detail));

  return g;
}
