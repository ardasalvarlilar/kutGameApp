// Uygulamanin kabugu — yalnizca oturum saglayicisini kurar.
//
// Ekran secimi `src/Uygulama.tsx`te. Ayrimin sebebi `useKimlik`: context'i
// kuran bilesen onu kendi icinde okuyamaz, saglayicinin ALTINDA bir bilesen
// gerekiyor.

import { KimlikSaglayici } from './src/ag/kimlik';
import { Uygulama } from './src/Uygulama';

export default function App() {
  return (
    <KimlikSaglayici>
      <Uygulama />
    </KimlikSaglayici>
  );
}
