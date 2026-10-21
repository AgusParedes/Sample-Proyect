import HomeHeader from './HomeHeader/HomeHeader.jsx';
import HeroPixel from '../src/HeroPixel/HeroPixel.jsx';
import WormSection from './WormSection/WormSection.jsx';
import { useState } from 'react';

function App() {
  const [ready, setReady] = useState(false);
  return (
      <>
      <HomeHeader ready={ready} />
      <HeroPixel
        onIntroStart={() => setReady(false)}
        onIntroDone={() => setReady(true)}
      />
      <WormSection />

    </>
  )
}

export default App;
