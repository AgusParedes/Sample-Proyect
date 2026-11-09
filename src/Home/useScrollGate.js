import { useCallback, useEffect, useRef } from 'react';

// "Tope" de scroll en las categorías.
// Mientras se baja desde el hero, el scroll no puede pasar del punto donde empiezan las categorías (el borde de arriba de `sectionRef`):
// se corta justo ahí, aunque el scroll sea fuerte. Ahí se queda quieto hasta que el zoom termine y la animación de entrada corra `holdMs`;
// después se suelta y se puede seguir bajando.
// El tope se vuelve a armar cuando volvés a subir al hero (onReveal(false)), así que funciona cada vez que entrás a las categorías.
// En el celular no se "clava" el scroll a cada evento (eso hacía temblar la pantalla): se salta una sola vez al punto y se bloquea el scroll de la página.
const isTouch = () => window.matchMedia('(pointer: coarse)').matches;
const setPageLock = (on) => {
  const v = on ? 'hidden' : '';
  document.documentElement.style.overflow = v;
  document.body.style.overflow = v;
  document.documentElement.style.touchAction = on ? 'none' : '';
};
const KEYS = [' ', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'End', 'Home'];

export default function useScrollGate(sectionRef, holdMs) {
  const s = useRef({ armed: true, holding: false, revealed: false, locked: false, y: 0, timer: 0, safety: 0 });

  const topY = () => {
    const el = sectionRef.current;
    return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : Infinity;
  };
  const jump = (y) => window.scrollTo({ top: y, left: 0, behavior: 'instant' }); // 'instant' porque el CSS usa scroll-behavior: smooth

  const end = useCallback(() => {
    if (s.current.locked) { s.current.locked = false; setPageLock(false); }
    clearTimeout(s.current.timer);
    clearTimeout(s.current.safety);
    s.current.holding = false;
  }, []);

  const begin = useCallback((y) => {
    const st = s.current;
    st.armed = false;
    st.holding = true;
    st.y = y;
    jump(y);
    if (isTouch()) { st.locked = true; setPageLock(true); }
    clearTimeout(st.timer);
    clearTimeout(st.safety);
    st.safety = setTimeout(end, holdMs + 2500); // por si el zoom nunca avisa que terminó
    if (st.revealed) st.timer = setTimeout(end, holdMs);
  }, [end, holdMs]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { s.current.armed = false; return undefined; }
    const st = s.current;

    const onWheel = (e) => {
      if (st.holding) { e.preventDefault(); return; }
      if (!st.armed) return;
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
      const y = topY();
      if (dy > 0 && window.scrollY + dy >= y - 1) { e.preventDefault(); begin(y); } // este gesto pasaba el tope: se corta justo en él
    };
    const onTouch = (e) => { if (st.holding && e.cancelable) e.preventDefault(); };
    const onKey = (e) => { if (st.holding && KEYS.includes(e.key)) e.preventDefault(); };
    const onScroll = () => {
      if (st.holding) { if (!st.locked && Math.abs(window.scrollY - st.y) > 1) jump(st.y); return; }
      if (st.armed) { const y = topY(); if (window.scrollY >= y - 1) begin(y); } // barra de scroll, teclado, táctil...
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchmove', onTouch, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll);
      end();
    };
  }, [begin, end, sectionRef]);

  // Avisarle cuando el zoom del hero termina (true) o se vuelve a salir hacia el hero (false)
  const onReveal = useCallback((v) => {
    const st = s.current;
    st.revealed = v;
    if (v) {
      if (st.holding) { clearTimeout(st.timer); st.timer = setTimeout(end, holdMs); } // la animación arranca ahora: contar el tiempo desde acá
    } else {
      end();
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) st.armed = true;
    }
  }, [end, holdMs]);

  return onReveal;
}
