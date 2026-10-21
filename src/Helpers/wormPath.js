// Recorrido del gusano. Lo comparten WormSection (que lo dibuja) y los pop-ups (que se ubican en las curvas).

export const CURVE_AMP = 0.3;    // cuánto se mueve de lado a lado (fracción del ancho de pantalla)
export const CURVE_LENGTH = 1;   // largo de cada curva (1 = normal, 1.5 = curvas más largas y suaves)

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth = (t) => { const x = clamp(t); return x * x * (3 - 2 * x); };

// Medidas del recorrido según el tamaño de la pantalla
export function getLayout(width, height) {
  return {
    amp: width * CURVE_AMP,
    wavelength: (height * 0.85 + 250) * CURVE_LENGTH,
    radius: clamp(width * 0.026, 16, 28),
  };
}

// x e z del gusano a una distancia d de donde sale. Arranca derecho y recién después serpentea.
export const pathX = (d, { amp, wavelength }) => amp * smooth(d / 350) * Math.sin((d / wavelength) * Math.PI * 2);
export const pathZ = (d, { wavelength }) => 55 * smooth(d / 350) * Math.sin((d / wavelength) * Math.PI * 2 + 1.2);

// Distancia (desde donde sale) a la que el gusano llega a la punta de su curva número k (1, 2, 3…)
export const curvePeak = (k, { wavelength }) => wavelength * (0.25 + (k - 1) * 0.5);

// De qué lado queda la punta de la curva k: la 1 va a la derecha, la 2 a la izquierda, la 3 a la derecha…
export const curveSideOfWorm = (k) => (k % 2 === 1 ? 'right' : 'left');
