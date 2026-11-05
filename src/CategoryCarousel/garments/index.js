import { fitModel } from './shapes.js';
import { buildTShirt } from './tshirt.js';
import { buildHoodie } from './hoodie.js';
import { buildPants } from './pants.js';

// Qué función arma cada prenda. Para cambiar una por un modelo tuyo, reemplazá la función de esa línea.
// Cada una recibe los materiales { cloth, detail, inner } y devuelve un THREE.Group.
const BUILDERS = {
  tshirt: buildTShirt,
  hoodie: buildHoodie,
  pants: buildPants,
};

export function buildGarment(type, mats) {
  return fitModel(BUILDERS[type](mats));
}
