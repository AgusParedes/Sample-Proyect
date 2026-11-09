import { useEffect, useRef } from 'react';
import './BrandStatement.scss';

// Textos de ejemplo: cambialos por los tuyos.
const PILLARS = [
  { title: 'Hecho para durar', text: 'Telas pesadas y costuras reforzadas, pensadas para usarse todos los días y mejorar con el tiempo.' },
  { title: 'Diseño propio', text: 'Cada prenda se dibuja en el estudio, con cortes cómodos y sin vueltas.' },
  { title: 'Tiradas cortas', text: 'Producimos en cantidades chicas para que lo que llevás no lo tenga todo el mundo.' },
];

export default function BrandStatement({ onCollection }) {
  const ref = useRef(null);

  // Los textos aparecen suavemente cuando entran en pantalla
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      el.classList.add('is-in');
      return undefined;
    }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.classList.add('is-in'); io.disconnect(); }
    }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section className="brand" ref={ref} aria-label="Sobre Samples Studio">
      <span className="brand__eyebrow brand__reveal" style={{ '--i': 0 }}>Samples Studio</span>
      <h2 className="brand__title brand__reveal" style={{ '--i': 1 }}>
        Ropa simple, hecha con calma, para usar todos los días.
      </h2>
      <p className="brand__lead brand__reveal" style={{ '--i': 2 }}>
        Remeras, buzos y pantalones que se sienten bien desde el primer día. Pocas prendas, bien hechas.
      </p>

      <ul className="brand__pillars">
        {PILLARS.map((p, i) => (
          <li key={p.title} className="brand__pillar brand__reveal" style={{ '--i': 3 + i }}>
            <span className="brand__num">{String(i + 1).padStart(2, '0')}</span>
            <h3 className="brand__pillar-title">{p.title}</h3>
            <p className="brand__pillar-text">{p.text}</p>
          </li>
        ))}
      </ul>

      <button className="brand__cta brand__reveal" style={{ '--i': 6 }} type="button" onClick={onCollection}>
        Ver toda la colección
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </button>
    </section>
  );
}
