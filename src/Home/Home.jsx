import { useState } from 'react';
import useScrollToTop from '../../hooks/useScrollToTop';
import HomeHeader from '../../components/HomeHeader/HomeHeader';
import HeroPixel3D from '../../components/HeroPixel/HeroPixel3D';
import WormSection from '../../components/Worm/WormSection';
import ProductPopup from '../../components/ProductPopup/ProductPopup';
import TShirt3D from '../../components/TShirt3D/TShirt3D';
import { featuredProducts } from '../../data/featuredProducts';
import './Home.scss';

// Qué se muestra en 3D dentro del pop-up según el tipo de producto (el `model` de featuredProducts.js)
const MEDIA = {
  tshirt: (open) => <TShirt3D active={open} />,
  // hoodie: (open) => <Hoodie3D active={open} />,   ← cuando hagamos los busos
};

export default function Home() {
  useScrollToTop(); // siempre arranca arriba, también al recargar
  const [introDone, setIntroDone] = useState(false);

  // TODO: conectar con tu router / menú
  const openMenu = () => {};
  const goToCart = () => {};
  const goToAccount = () => {};

  // Un pop-up por cada producto destacado, ubicado en su curva del gusano
  const wormStops = featuredProducts.map((product) => ({
    id: product.id,
    curve: product.curve,
    render: (open, side) => (
      <ProductPopup
        open={open}
        side={side}
        media={MEDIA[product.model]?.(open)}
        eyebrow={product.eyebrow}
        title={product.title}
        text={product.text}
        ctaLabel={product.ctaLabel}
        href={product.href}
      />
    ),
  }));

  return (
    <main className="home">
      <HomeHeader
        ready={introDone}
        onMenu={openMenu}
        onCart={goToCart}
        onAccount={goToAccount}
      />
      <HeroPixel3D
        onIntroStart={() => setIntroDone(false)}
        onIntroDone={() => setIntroDone(true)}
      />
      <WormSection stops={wormStops} />
      <ProductPopup
        open={open}
        side={side}
        media={MEDIA[product.model]?.(open)}
        eyebrow={product.eyebrow}
        title={product.title}
        text={product.text}
        ctaLabel={product.ctaLabel}
        href={product.href}
      />
    </main>
  );
}
