import './WhiteSection.scss';

// Sección blanca que aparece al terminar el zoom del hero.
// Más adelante acá va el gusano con los pop-ups.
export default function WhiteSection({ children }) {
  return <section className="white-section">{children}</section>;
}
