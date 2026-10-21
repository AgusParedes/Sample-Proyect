import './HomeHeader.scss';
import samplesWord from '../../assets/samples-blanco.png';
import studioWord from '../../assets/studio-blanco.png';

// Header de la página de inicio.
//  - `ready`: pasa a true cuando termina la animación del hero (entonces todo aparece).
//  - `cartCount`: si es mayor que 0 se muestra un numerito sobre el carrito.
//  - `onMenu`, `onCart`, `onAccount`: qué hace cada botón al hacer clic.
export default function HomeHeader({ ready = false, cartCount = 0, onMenu, onCart, onAccount }) {
  return (
    <header className={`home-header${ready ? ' is-ready' : ''}`}>
      <div className="home-header__side home-header__side--left">
        <button className="home-header__btn" type="button" aria-label="Abrir menú" onClick={onMenu}>
          <span className="home-header__bars" aria-hidden="true">
            <i /><i /><i />
          </span>
        </button>
      </div>

      <a className="home-header__brand" href="/" aria-label="Samples Studio">
        <span className="home-header__word" style={{ '--d': '0s' }}>
          <img src={samplesWord} alt="" draggable="false" />
        </span>
        <span className="home-header__word" style={{ '--d': '.14s' }}>
          <img src={studioWord} alt="" draggable="false" />
        </span>
      </a>

      <div className="home-header__side home-header__side--right">
        <button
          className="home-header__btn"
          type="button"
          aria-label={cartCount > 0 ? `Carrito, ${cartCount} productos` : 'Carrito'}
          onClick={onCart}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 4h2.2l2.1 10.2a1.5 1.5 0 0 0 1.47 1.2h8.55a1.5 1.5 0 0 0 1.46-1.15L20.4 8H6.1" />
            <circle cx="9.6" cy="19.4" r="1.2" />
            <circle cx="16.8" cy="19.4" r="1.2" />
          </svg>
          {cartCount > 0 && <span className="home-header__badge">{cartCount > 9 ? '9+' : cartCount}</span>}
        </button>
        <button className="home-header__btn" type="button" aria-label="Mi cuenta" onClick={onAccount}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="8" r="3.7" />
            <path d="M4.6 20.2c.9-3.9 4-6.1 7.4-6.1s6.5 2.2 7.4 6.1" />
          </svg>
        </button>
      </div>
    </header>
  );
}
