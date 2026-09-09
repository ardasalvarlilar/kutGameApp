import type { Renk } from '@kut/engine';

export const renkler = {
  // Masa disi zemin
  arka: '#0b2739',
  arkaKoyu: '#071c2a',
  // Masa (keçe)
  masa: '#0e3b4d',
  masaCizgi: '#1b5570',
  masaKoyu: '#0a2f3e',
  // Paneller
  panel: '#123c52',
  panelKoyu: '#0d2f40',
  kenar: '#1d5872',
  // Ahsap istaka
  ahsap: '#a5692c',
  ahsapAcik: '#c98b46',
  ahsapKoyu: '#6f4318',
  // Metin
  metin: '#e9f3f8',
  metinSolgun: '#7fa8bd',
  // Vurgular
  vurgu: '#f2c14e',
  vurguKoyu: '#8a6a16',
  uyari: '#e5734b',
  onay: '#4fbf87',
  // Tas
  tasZemin: '#f7f3e8',
  tasKenar: '#cfc5ac',
  tasGolge: '#b9ad90',
};

export const tasRenkleri: Record<Renk, string> = {
  kirmizi: '#d32f2f',
  siyah: '#22303a',
  mavi: '#1976d2',
  sari: '#e39a00',
};

export const okeyRengi = '#7b1fa2';

/**
 * Paylaşılan gölge/derinlik ölçekleri.
 *
 * RN'de `boxShadow` yok; iOS `shadow*`, Android `elevation` okuyor — ikisini
 * birden vermek gerekiyor. Üç kademe: kart (hafif kabartma), yükseltilmiş
 * (modal/vurgu düğmesi), masa (en derin — oyunun kendisi).
 */
export const golge = {
  kart: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 3,
  },
  yukseltilmis: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  masa: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;
