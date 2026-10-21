import { useEffect, useRef, useState } from 'react';

const OPEN_RATIO = 0.35;  // se abre cuando se ve al menos esta parte del pop-up en pantalla
const CLOSE_RATIO = 0.05; // se cierra cuando ya casi no se ve (así se vuelve a animar al regresar)

/**
 * Lugar de un pop-up en una curva del gusano. Detecta cuándo entra en cámara y cuándo sale.
 *  - side: 'left' | 'right' (de qué lado del gusano queda)
 *  - y: altura de la punta de la curva, en px desde el borde de arriba de la sección
 *  - render(open, side): devuelve el contenido (por ejemplo un <ProductPopup />)
 */
export default function WormStop({ side, y, render }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let isOpen = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const ratio = entry.intersectionRatio;
        if (!isOpen && ratio >= OPEN_RATIO) { isOpen = true; setOpen(true); }
        else if (isOpen && ratio <= CLOSE_RATIO) { isOpen = false; setOpen(false); }
      },
      { threshold: [0, 0.05, 0.2, 0.35, 0.6, 1] }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`worm__stop worm__stop--${side}`} style={{ '--stop-y': `${y}px` }}>
      {render(open, side)}
    </div>
  );
}
