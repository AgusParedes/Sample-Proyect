import * as THREE from 'three';
import { symmetric, roundedShape, puffy } from './shapes.js';

// Pantalón de pierna ancha, con cintura, costura y botón
export function buildPants({ cloth, detail }) {
  const g = new THREE.Group();

  const half = [
    [0, 1.2], [0.66, 1.2],  // cintura
    [0.72, 0.5],            // cadera
    [0.7, -1.25],           // tobillo de afuera
    [0.14, -1.25],          // tobillo de adentro
    [0, 0.02],              // entrepierna
  ];
  g.add(new THREE.Mesh(puffy(roundedShape(symmetric(half), 0.07), { bevel: 0.09 }), cloth));

  // Cinturilla
  const band = roundedShape([[-0.68, 1.2], [0.68, 1.2], [0.7, 0.95], [-0.7, 0.95]], 0.05);
  const bandMesh = new THREE.Mesh(puffy(band, { depth: 0.03, bevel: 0.04, segments: 4 }), detail);
  bandMesh.position.z = 0.12;
  g.add(bandMesh);

  // Costura del medio
  const seam = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.83, 0.02), detail);
  seam.position.set(0, 0.535, 0.125);
  g.add(seam);

  // Botón
  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 20), detail);
  button.rotation.x = Math.PI / 2;
  button.position.set(0, 1.07, 0.19);
  g.add(button);

  return g;
}
