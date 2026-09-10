import { describe, expect, it } from 'vitest';
import { normalTas, type Renk, type Sayi, type Tas } from '@kut/engine';
import { slotaYerlestir, type Duzen } from './duzen';
import { ISTAKA_PAYI, istakaSlotuBul, type IzgaraOlcusu } from './hedefler';

// Ortadan tas cekmek artik fiziksel bir surukleme: tas istakanin ustune
// birakilirsa cekiliyor ve BIRAKILDIGI slota giriyor; baska yere birakilirsa
// hicbir sey olmuyor.

const t = (renk: Renk, sayi: Sayi): Tas => normalTas(renk, sayi, 'a');
const a = t('kirmizi', 1).id;
const b = t('kirmizi', 2).id;
const c = t('kirmizi', 3).id;
const d = t('mavi', 9).id;
const yeni = t('sari', 5).id;

// 2 satir x 5 sutun
const SUTUN = 5;

describe('slotaYerlestir — cekilen tas birakildigi yere', () => {
  it('bos slota birakilan tas oraya gider, sondaki yeri bosalir', () => {
    // duzenTazele yeni tasi sona koymus (indeks 9).
    const duzen: Duzen = [a, b, null, null, null, null, null, null, null, yeni];
    expect(slotaYerlestir(duzen, yeni, 3, SUTUN)).toEqual([
      a, b, null, yeni, null, null, null, null, null, null,
    ]);
  });

  it('dolu slotta taslar saga, en yakin bosluga dogru kayar', () => {
    const duzen: Duzen = [a, b, c, null, d, null, null, null, null, yeni];
    // b'nin yerine birakildi: b ve c birer saga, bosluga kayiyor; d yerinde.
    expect(slotaYerlestir(duzen, yeni, 1, SUTUN)).toEqual([
      a, yeni, b, c, d, null, null, null, null, null,
    ]);
  });

  it('sagda yer yoksa sola kayar', () => {
    const duzen: Duzen = [null, a, b, c, d, yeni, null, null, null, null];
    expect(slotaYerlestir(duzen, yeni, 3, SUTUN)).toEqual([
      a, b, c, yeni, d, null, null, null, null, null,
    ]);
  });

  it('kayma baska satira tasmaz', () => {
    // Ust satir dolu; yeni tas alt satirda duruyor.
    const duzen: Duzen = [a, b, c, d, t('mavi', 1).id, yeni, null, null, null, null];
    expect(slotaYerlestir(duzen, yeni, 2, SUTUN)).toBe(duzen);
  });

  it('yeni tasin kendi eski yeri de bosluk sayilir', () => {
    const duzen: Duzen = [a, b, yeni, null, null, null, null, null, null, null];
    expect(slotaYerlestir(duzen, yeni, 0, SUTUN)).toEqual([
      yeni, a, b, null, null, null, null, null, null, null,
    ]);
  });

  it('tas duzende yoksa ya da zaten yerindeyse ayni dizi doner', () => {
    const duzen: Duzen = [a, null, null, null, null, null, null, null, null, null];
    expect(slotaYerlestir(duzen, yeni, 2, SUTUN)).toBe(duzen);
    expect(slotaYerlestir(duzen, a, 0, SUTUN)).toBe(duzen);
    expect(slotaYerlestir(duzen, a, 99, SUTUN)).toBe(duzen);
  });
});

describe('istakaSlotuBul — tas istakaya mi birakildi', () => {
  const izgara = { x: 100, y: 500, en: 5 * 27, boy: 2 * 38 };
  const olcu: IzgaraOlcusu = { sutunSayisi: 5, satirSayisi: 2, slotEn: 27, slotBoy: 38 };

  it('izgaranin ustundeki nokta slota cevrilir', () => {
    expect(istakaSlotuBul({ x: 101, y: 501 }, izgara, olcu)).toBe(0);
    expect(istakaSlotuBul({ x: 100 + 27 * 2 + 5, y: 501 }, izgara, olcu)).toBe(2);
    expect(istakaSlotuBul({ x: 100 + 27 * 4 + 5, y: 500 + 38 + 5 }, izgara, olcu)).toBe(9);
  });

  it('ortaya geri birakilan tas cekilmez', () => {
    // Istakanin cok ustu — masanin ortasi.
    expect(istakaSlotuBul({ x: 150, y: 200 }, izgara, olcu)).toBe(null);
    expect(istakaSlotuBul({ x: 150, y: 500 - ISTAKA_PAYI - 1 }, izgara, olcu)).toBe(null);
  });

  it('ahsap kenara birakilan tas en yakin slota yuvarlanir', () => {
    expect(istakaSlotuBul({ x: 100 - 5, y: 500 - 5 }, izgara, olcu)).toBe(0);
    expect(istakaSlotuBul({ x: 100 + 5 * 27 + 5, y: 500 + 2 * 38 + 5 }, izgara, olcu)).toBe(9);
  });
});
