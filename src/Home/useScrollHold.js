import { useCallback, useEffect, useRef } from 'react';

// Frena el scroll un instante en un punto fijo de la página (por ejemplo, mientras corre la animación de entrada de las categorías).
// hold(el, ms): deja el borde de arriba de `el` pegado al borde de la pantalla y bloquea el scroll durante `ms` milisegundos.
// release(): lo suelta antes de tiempo.
const KEYS = [' ', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'End', 'Home'];

export default function useScrollHold() {
  const undo = useRef(null);

  const release = useCallback(() => {
    undo.current?.();
    undo.current = null;
  }, []);

  const hold = useCallback((el, ms) => {
    release();
    if (!el) return;
    const y = Math.round(el.getBoundingClientRect().top + window.scrollY);
    const jump = () => window.scrollTo({ top: y, left: 0, behavior: 'instant' }); // 'instant' porque el CSS usa scroll-behavior: smooth
    const stop = (e) => e.preventDefault();
    const onKey = (e) => { if (KEYS.includes(e.key)) e.preventDefault(); };
    const pin = () => { if (Math.abs(window.scrollY - y) > 1) jump(); };

    jump();
    window.addEventListener('wheel', stop, { passive: false });
    window.addEventListener('touchmove', stop, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', pin, { passive: true });
    const timer = setTimeout(release, ms);

    undo.current = () => {
      clearTimeout(timer);
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchmove', stop);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', pin);
    };
  }, [release]);

  useEffect(() => release, [release]);

  return { hold, release };
}
