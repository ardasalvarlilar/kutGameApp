// Uygulamanin kabugu — dil ve oturum saglayicilarini kurar.
//
// Ekran secimi `src/Uygulama.tsx`te. Ayrimin sebebi `useKimlik`: context'i
// kuran bilesen onu kendi icinde okuyamaz, saglayicinin ALTINDA bir bilesen
// gerekiyor.
//
// Dil EN DISTA: giris ekrani da dahil her sey cevrilebilmeli ve dil tercihi
// oturumdan bagimsiz (cihaza ait, bkz. ag/depo.ts).

import { DilSaglayici } from './src/dil';
import { KimlikSaglayici } from './src/ag/kimlik';
import { Uygulama } from './src/Uygulama';

export default function App() {
  return (
    <DilSaglayici>
      <KimlikSaglayici>
        <Uygulama />
      </KimlikSaglayici>
    </DilSaglayici>
  );
}
