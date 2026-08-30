// Kucuk gunluk (log) yardimcisi.
//
// Ayri bir dosya cunku ileride bunu bir kutuphaneye (pino gibi) baglamak
// isteyebiliriz; o zaman yalnizca burasi degisir. Motor gunluk tutmaz
// (CLAUDE.md #1: konsol yok) — kayit yalnizca sunucu katmaninda.

const zaman = (): string => new Date().toISOString();

export const kayit = {
  bilgi: (mesaj: string, ek?: unknown): void => {
    if (ek === undefined) console.log(`[${zaman()}] ${mesaj}`);
    else console.log(`[${zaman()}] ${mesaj}`, ek);
  },
  uyari: (mesaj: string, ek?: unknown): void => {
    if (ek === undefined) console.warn(`[${zaman()}] UYARI ${mesaj}`);
    else console.warn(`[${zaman()}] UYARI ${mesaj}`, ek);
  },
  hata: (mesaj: string, ek?: unknown): void => {
    if (ek === undefined) console.error(`[${zaman()}] HATA ${mesaj}`);
    else console.error(`[${zaman()}] HATA ${mesaj}`, ek);
  },
};
