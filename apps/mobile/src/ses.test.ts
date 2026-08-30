import { describe, expect, it } from 'vitest';
import { sesGirdisi, sesSec } from './ses';

// Ses, motorun degil ekranin isi. `sesSec` iki gorunumu karsilastirip
// hangi efektin calacagini soyluyor — saf oldugu icin test edilebiliyor.

const girdi = (atikAdedi: number, desteSayisi: number, yerdekiTasSayisi: number) => ({
  atikAdedi,
  desteSayisi,
  yerdekiTasSayisi,
});

describe('sesSec', () => {
  it('hicbir sey degismediyse ses yok', () => {
    expect(sesSec(girdi(3, 40, 6), girdi(3, 40, 6))).toBeNull();
  });

  it('atik artarsa atma sesi', () => {
    expect(sesSec(girdi(3, 40, 6), girdi(4, 40, 6))).toBe('at');
  });

  it('desteden cekilirse cekme sesi', () => {
    expect(sesSec(girdi(3, 40, 6), girdi(3, 39, 6))).toBe('cek');
  });

  it('yerden alinirsa cekme sesi — atik azalir', () => {
    expect(sesSec(girdi(3, 40, 6), girdi(2, 40, 6))).toBe('cek');
  });

  it('yerdeki tas artarsa isleme sesi', () => {
    expect(sesSec(girdi(3, 40, 6), girdi(3, 40, 7))).toBe('isle');
  });

  it('acilis da isleme sesi verir — yere per indi', () => {
    expect(sesSec(girdi(3, 40, 0), girdi(3, 40, 6))).toBe('isle');
  });

  it('ayni tick icinde cekme + atma olursa atis duyulur', () => {
    // Sure dolunca surucu ikisini birden gonderiyor; ekranda goze carpan atis.
    expect(sesSec(girdi(3, 40, 6), girdi(4, 39, 6))).toBe('at');
  });

  it('el yeniden dagitilinca (deste buyur) ses yok', () => {
    expect(sesSec(girdi(5, 20, 9), girdi(0, 49, 0))).toBeNull();
  });
});

describe('sesGirdisi', () => {
  it('yerdeki taslari sayar', () => {
    const gorunum = {
      atikAdedi: 4,
      desteSayisi: 30,
      yer: [{ taslar: [1, 2, 3] }, { taslar: [4, 5, 6, 7] }],
    };
    expect(sesGirdisi(gorunum)).toEqual({ atikAdedi: 4, desteSayisi: 30, yerdekiTasSayisi: 7 });
  });

  it('yer bossa sifir', () => {
    expect(sesGirdisi({ atikAdedi: 0, desteSayisi: 49, yer: [] }).yerdekiTasSayisi).toBe(0);
  });
});
