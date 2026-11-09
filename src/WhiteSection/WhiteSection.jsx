import './WhiteSection.scss';

// Sección blanca que aparece al terminar el zoom del hero.
// Tiene dos partes: el "panel" (una pantalla entera, con las categorías centradas) y lo que sigue abajo.
// sectionRef: lo usa Home para frenar el scroll justo donde empieza el panel.
export default function WhiteSection({ sectionRef, panel, children }) {
  return (
    <section className="white-section" ref={sectionRef}>
      <div className="white-section__panel">{panel}</div>
      {children}
    </section>
  );
}
