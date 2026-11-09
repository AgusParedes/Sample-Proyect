import { useEffect, useRef, useState } from 'react';
import HomeHeader from '../HomeHeader/HomeHeader.jsx';
import HeroPixel from '../HeroPixel/HeroPixel.jsx';
import WhiteSection from '../WhiteSection/WhiteSection.jsx';
import CategoryCarousel from '../CategoryCarousel/CategoryCarousel.jsx';
import BrandStatement from '../BrandStatement/BrandStatement.jsx';
import useScrollHold from './useScrollHold.js';
import './Home.scss';

// Cuánto se queda quieta la pantalla en las categorías mientras corre la animación de entrada (milisegundos)
const HOLD_MS = 1300;

export default function Home() {
  const [introDone, setIntroDone] = useState(false);
  const [revealed, setRevealed] = useState(false); // el zoom del hero terminó: ya se ve la sección blanca
  const whiteRef = useRef(null);
  const { hold, release } = useScrollHold();

  // Al entrar o recargar, la página siempre arranca arriba, en el hero
  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  // Cuando termina el zoom: las categorías quedan centradas y el scroll espera a que termine la animación
  const onReveal = (v) => {
    setRevealed(v);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (v && !reduceMotion) hold(whiteRef.current, HOLD_MS);
    else release();
  };

  // TODO: conectar con tu router / menú
  const openMenu = () => {};
  const goToCart = () => {};
  const goToAccount = () => {};
  const goToCategory = () => {}; // TODO: ir a la página de la categoría (recibe 'remeras', 'buzos' o 'pantalones')
  const goToCollection = () => {}; // TODO: ir a la página con toda la colección

  return (
    <main className="home">
      <HomeHeader ready={introDone} onMenu={openMenu} onCart={goToCart} onAccount={goToAccount} />
      <HeroPixel onIntroStart={() => setIntroDone(false)} onIntroDone={() => setIntroDone(true)} onReveal={onReveal} />
      <WhiteSection sectionRef={whiteRef} panel={<CategoryCarousel play={revealed} onSelect={goToCategory} />}>
        <BrandStatement onCollection={goToCollection} />
      </WhiteSection>
    </main>
  );
}
