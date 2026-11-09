import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { fitModel } from './shapes.js';
import { buildTShirt } from './tshirt.js';
import { buildHoodie } from './hoodie.js';
import { buildPants } from './pants.js';

export const GARMENT_SIZE = 2.4; // alto de cada prenda en unidades 3D (todas se escalan a esto)

// 1) Prendas armadas en código (siempre disponibles). Cada una recibe { cloth, detail, inner } y devuelve un THREE.Group.
const BUILDERS = {
  tshirt: buildTShirt,
  hoodie: buildHoodie,
  pants: buildPants,
};

export function buildGarment(type, mats) {
  return fitModel(BUILDERS[type](mats), GARMENT_SIZE);
}

// 2) Modelos realistas (opcional): poné los archivos .glb en la carpeta public/models/ con estos nombres.
// Si el archivo existe, reemplaza a la prenda armada en código; si no existe, no pasa nada.
//   rot: [x, y, z] en radianes, por si el modelo viene girado o acostado (ej: [0, Math.PI, 0] lo da vuelta)
const MODEL_FILES = {
  tshirt: { url: '/models/t_shirt.glb' },
  hoodie: { url: '/models/buzo.glb' },
  pants: { url: '/models/pantalon.glb' },
};

const loader = new GLTFLoader();

export function loadRealModel(type) {
  const cfg = MODEL_FILES[type];
  if (!cfg) return Promise.resolve(null);
  return new Promise((resolve) => {
    loader.load(
      cfg.url,
      (gltf) => {
        const root = gltf.scene;
        if (cfg.rot) root.rotation.set(...cfg.rot);
        // Actualiza las transformaciones del GLB antes de calcular su tamaño y centrarlo.
        root.updateMatrixWorld(true);
        resolve(fitModel(root, GARMENT_SIZE));
      },
      undefined,
      () => resolve(null), // no está el archivo (o no se pudo leer): queda la prenda de código
    );
  });
}
