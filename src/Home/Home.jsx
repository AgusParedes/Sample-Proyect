import { useEffect, useState } from 'react';
import HomeHeader from '../HomeHeader/HomeHeader.jsx';
import HeroPixel from '../HeroPixel/HeroPixel.jsx';
import WhiteSection from '../WhiteSection/WhiteSection.jsx';
import CategoryCarousel from '../CategoryCarousel/CategoryCarousel.jsx';
import './Home.scss';

export default function Home() {
  const [introDone, setIntroDone] = useState(false);

  // Al entrar o recargar, la página siempre arranca arriba, en el hero
  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  // TODO: conectar con tu router / menú
  const openMenu = () => {};
  const goToCart = () => {};
  const goToAccount = () => {};
  const goToCategory = () => {}; // TODO: ir a la página de la categoría (recibe 'remeras', 'buzos' o 'pantalones')

  return (
    <main className="home">
      <HomeHeader ready={introDone} onMenu={openMenu} onCart={goToCart} onAccount={goToAccount} />
      <HeroPixel onIntroStart={() => setIntroDone(false)} onIntroDone={() => setIntroDone(true)} />
      <WhiteSection>
        <CategoryCarousel onSelect={goToCategory} />
      </WhiteSection>
    </main>
  );
}
