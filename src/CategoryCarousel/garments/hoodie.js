import * as THREE from 'three';
import { symmetric, roundedShape, puffy, ellipse, v2 } from './shapes.js';

// Buzo con capucha, bolsillo canguro y cordones
export function buildHoodie({ cloth, detail, inner }) {
  const g = new THREE.Group();

  // Cuerpo con mangas largas
  const half = [
    [0, 0.55], [0.2, 0.6], [0.42, 0.78], [0.58, 0.98], // escote (lo tapa la capucha)
    [1.05, 0.88],                                       // hombro
    [1.52, -0.62], [1.5, -0.84], [1.22, -0.9],          // manga hasta el puño
    [0.9, -0.02],                                       // axila
    [0.9, -1.15], [0, -1.15],
  ];
  g.add(new THREE.Mesh(puffy(roundedShape(symmetric(half), 0.08), { bevel: 0.08 }), cloth));

  // Ruedo
  const hem = roundedShape([[-0.9, -0.98], [0.9, -0.98], [0.9, -1.15], [-0.9, -1.15]], 0.04);
  const hemMesh = new THREE.Mesh(puffy(hem, { depth: 0.02, bevel: 0.03, segments: 4 }), detail);
  hemMesh.position.z = 0.11;
  g.add(hemMesh);

  // Capucha: un aro con el hueco de la cara
  const ring = new THREE.Shape(v2(ellipse(0, 1.1, 0.68, 0.58)));
  ring.holes.push(new THREE.Path(v2(ellipse(0, 1.08, 0.42, 0.38))));
  const ringMesh = new THREE.Mesh(puffy(ring, { depth: 0.08, bevel: 0.04, segments: 5 }), cloth);
  ringMesh.position.z = 0.13;
  g.add(ringMesh);

  // Interior oscuro de la capucha (se ve por el hueco)
  const dark = new THREE.Shape(v2(ellipse(0, 1.08, 0.46, 0.42)));
  const darkMesh = new THREE.Mesh(puffy(dark, { depth: 0.02, bevel: 0.01, segments: 2 }), inner);
  darkMesh.position.z = 0.115;
  g.add(darkMesh);

  // Bolsillo canguro
  const pocket = roundedShape([[-0.55, -0.18], [0.55, -0.18], [0.68, -0.8], [-0.68, -0.8]], 0.1);
  const pocketMesh = new THREE.Mesh(puffy(pocket, { depth: 0.03, bevel: 0.04, segments: 4 }), detail);
  pocketMesh.position.z = 0.13;
  g.add(pocketMesh);

  // Cordones
  const cordGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.62, 10);
  const tipGeo = new THREE.SphereGeometry(0.045, 12, 12);
  for (const sx of [-1, 1]) {
    const cord = new THREE.Mesh(cordGeo, detail);
    cord.position.set(sx * 0.16, 0.35, 0.21);
    const tip = new THREE.Mesh(tipGeo, detail);
    tip.position.set(sx * 0.16, 0.04, 0.21);
    g.add(cord, tip);
  }

  return g;
}
