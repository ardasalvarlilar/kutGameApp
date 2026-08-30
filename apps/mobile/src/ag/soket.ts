// Soket baglantisi.
//
// Tek bir baglanti var ve modul seviyesinde duruyor: React agaci yeniden
// kurulsa bile (ekran degisimi, hizli yenileme) ayni soket kullaniliyor.
// Her ekranin kendi baglantisini acmasi, sunucuda ayni oyuncunun dort
// soketi demek olurdu.
//
// Yeniden baglanmayi socket.io kendisi yapiyor; ustune tek ekledigimiz sey
// baglanti geri geldiginde "hangi masadayim?" diye sormak (useCevrimiciMasa).

import { io, type Socket } from 'socket.io-client';
import { SUNUCU_ADRESI } from './sunucu';

let soket: Socket | null = null;
let acikJeton: string | null = null;

/**
 * Baglantiyi acar. Ayni jetonla ikinci cagri MEVCUT soketi doner —
 * jeton degistiyse (baska hesaba gecildi) eski baglanti kapatilir.
 */
export function soketiAc(jeton: string): Socket {
  if (soket !== null && acikJeton === jeton) return soket;
  soketiKapat();

  acikJeton = jeton;
  soket = io(SUNUCU_ADRESI, {
    auth: { jeton },
    // Mobilde uzun yoklama (polling) pil yiyor ve gecikmeyi artiriyor;
    // dogrudan websocket. Sunucu da websocket'i destekliyor.
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 800,
    reconnectionDelayMax: 5_000,
    timeout: 12_000,
  });
  return soket;
}

export function soketiKapat(): void {
  if (soket !== null) {
    soket.removeAllListeners();
    soket.disconnect();
  }
  soket = null;
  acikJeton = null;
}

export function acikSoket(): Socket | null {
  return soket;
}

/**
 * Geri cagrili olay gonderir ve yaniti Promise olarak doner.
 *
 * Sunucu yanit vermezse SONSUZA KADAR beklemez: baglanti kopmus olabilir ve
 * ekranda donen bir tekerlek birakmak, hata gostermekten kotudur.
 */
export function sor<T>(
  soketi: Socket,
  olay: string,
  girdi: unknown = {},
  sureMs = 10_000,
): Promise<{ ok: true; veri: T } | { ok: false; hata: string }> {
  return new Promise((coz) => {
    let bitti = false;
    const sayac = setTimeout(() => {
      if (bitti) return;
      bitti = true;
      coz({ ok: false, hata: 'Sunucu yanıt vermedi' });
    }, sureMs);

    soketi.emit(olay, girdi, (sonuc: { ok: true; veri: T } | { ok: false; hata: string }) => {
      if (bitti) return;
      bitti = true;
      clearTimeout(sayac);
      coz(sonuc);
    });
  });
}

export type { Socket };
