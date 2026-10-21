import { useEffect, useId, useMemo, useRef } from 'react';
import { blobPoints, pointsToPath, easeInOutCubic, clamp01 } from '../Helpers/blobShape';
import './BlobReveal.scss';

// ── Ajustes rápidos ──────────────────────────────────────────────
const OPEN_TIME = 1.2;   // segundos que tarda en expandirse
const CLOSE_TIME = 0.55; // segundos que tarda en cerrarse
// ─────────────────────────────────────────────────────────────────

/**
 * Muestra su contenido dentro de un manchón blanco que se expande cuando `open` es true.
 *  - from: de dónde nace la mancha: 'left' | 'right' | 'center' (lado del recuadro más cercano al gusano)
 *  - roundness / size / wobble: forma del manchón (ver blobShape.js)
 *  - as: etiqueta HTML del contenedor (por defecto div)
 * Agrega la clase `is-open` al contenedor para que el contenido pueda animarse en sincronía.
 */
export default function BlobReveal({
  open = false, from = 'center', roundness = 4.5, size = 0.94, wobble = 0.03,
  as: Tag = 'div', className = '', children, ...rest
}) {
  const rootRef = useRef(null);
  const pathRef = useRef(null);
  const id = `blob-${useId().replace(/:/g, '')}`;
  const anim = useRef({ p: 0, from: 0, to: 0, start: 0, duration: OPEN_TIME, frame: 0 });
  const origin = from === 'right' ? [1, 0.5] : from === 'left' ? [0, 0.5] : [0.5, 0.5];
  const shape = { roundness, size, wobble, origin };

  const initialPath = useMemo(() => pointsToPath(blobPoints({ progress: 0, ...shape })), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const root = rootRef.current;
    const path = pathRef.current;
    const a = anim.current;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const draw = (time) => path.setAttribute('d', pointsToPath(blobPoints({ progress: a.p, time, ...shape })));

    function tick(now) {
      const k = clamp01((now - a.start) / (a.duration * 1000));
      if (reduceMotion) a.p = a.to;
      else a.p = a.to > a.from ? a.from + (1 - a.from) * k : a.from * (1 - easeInOutCubic(k));
      draw(reduceMotion ? 0 : now / 1000);

      if (a.to === 0 && k >= 1) {            // terminó de cerrarse: se oculta del todo y se frena
        a.p = 0;
        root.dataset.state = 'closed';
        return;
      }
      if (reduceMotion && k >= 1) return;
      a.frame = requestAnimationFrame(tick);  // abierto: sigue para que el borde respire
    }

    cancelAnimationFrame(a.frame);
    a.from = a.p;
    a.to = open ? 1 : 0;
    a.start = performance.now();
    a.duration = open ? OPEN_TIME : CLOSE_TIME;
    if (open) root.dataset.state = 'open';
    if (a.from !== a.to || open) a.frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(a.frame);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Tag ref={rootRef} data-state="closed" className={`blob-reveal${open ? ' is-open' : ''} ${className}`.trim()} {...rest}>
      {/* Define el recorte; se actualiza en cada frame desde el efecto de arriba */}
      <svg className="blob-reveal__defs" width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id={id} clipPathUnits="objectBoundingBox">
            <path ref={pathRef} d={initialPath} />
          </clipPath>
        </defs>
      </svg>
      <div className="blob-reveal__shape" style={{ clipPath: `url(#${id})`, WebkitClipPath: `url(#${id})` }}>
        {children}
      </div>
    </Tag>
  );
}
