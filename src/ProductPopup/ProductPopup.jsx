import BlobReveal from '../BlobReveal/BlobReveal';
import brandName from '../../assets/nombre-blanco.png';
import './ProductPopup.scss';

/**
 * Pop-up de un producto destacado: un manchón negro que se expande cuando `open` es true.
 *  - side: de qué lado del gusano está el pop-up ('left' | 'right'); la mancha nace del borde que mira al gusano
 *  - media: lo que va arriba (por ejemplo la remera en 3D)
 *  - eyebrow / title / text: textos
 *  - ctaLabel + href (o onCta): el botón
 */
export default function ProductPopup({ open = false, side = 'left', media, eyebrow, title, text, ctaLabel = 'Ver más', href, onCta }) {
  const inner = (
    <>
      <span>{ctaLabel}</span>
      <i aria-hidden="true">→</i>
    </>
  );
  const button = href ? (
    <a className="product-popup__cta" href={href}>{inner}</a>
  ) : (
    <button className="product-popup__cta" type="button" onClick={onCta}>{inner}</button>
  );

  return (
    <BlobReveal as="article" className="product-popup" open={open} from={side === 'left' ? 'right' : 'left'} aria-label={title}>
      <div className="product-popup__stage">{media}</div>

      <div className="product-popup__body">
        <img className="product-popup__brand" src={brandName} alt="Samples Studio" style={{ '--i': 0 }} draggable="false" />
        {eyebrow && <p className="product-popup__eyebrow" style={{ '--i': 1 }}>{eyebrow}</p>}
        <h3 className="product-popup__title" style={{ '--i': 2 }}>{title}</h3>
        <p className="product-popup__text" style={{ '--i': 3 }}>{text}</p>
        <div className="product-popup__action" style={{ '--i': 4 }}>{button}</div>
      </div>
    </BlobReveal>
  );
}
