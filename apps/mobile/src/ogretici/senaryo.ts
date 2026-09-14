// Ogreticinin senaryo eli.
//
// Ogretici gercek motoru oynatiyor — sahte bir ekran degil. Ama gosterecegi
// seyler (2 x uclu kutle acilis, kutteki okeyi cekme, calma) rastgele bir elde
// denk gelmez; bu yuzden dagitim BASTAN kuruluyor ve `elKur` ile veriliyor.
//
// Tohum arayarak bu eli bulmak pratik degil: dort elin ve deste sirasinin ayni
// anda tutmasi gerekiyor.
//
// --- Oturma duzeni --------------------------------------------------------
//
// Kullanici 0 numarali koltukta ve BASLAYAN (15 tas, cekmeden atar §1).
// Oyun yonu koltuk numarasini azaltiyor (§4), yani sira: 0 → 3 → 2 → 1 → 0.
//
// --- Senaryonun kovaladigi anlar -------------------------------------------
//
//   AÇ            kullanicinin elinde hazir 2 x uclu kut var (tur 1 sarti)
//   TAŞLARI İŞLE  `sari7` kendi kutunu dorde tamamliyor
//   OKEY AL       3 numarali `kirmizi5 + mavi5 + okey` aciyor; kullanicinin
//                 elinde `siyah5` ve `sari5` var. KURALLAR.md §6: kutteki
//                 okeyi almak icin kutu DORT RENGE tamamlamak gerekiyor —
//                 kuralin kendi ornegi bu.
//   İSTİYORUM     2 numarali `siyah9` atiyor. Atanin sagindaki 1 numarali
//                 (§5 onceligi) desteden cekiyor, tas kullaniciya kaliyor.
//
// Yer tutucularin hamlelerini GERCEK bot politikasi (`@kut/politika`)
// oynatiyor; ayri bir senaryo listesi yok. Bu yuzden eller ve destenin ilk
// tasi, botun kararlarini bu anlara goturecek sekilde kuruluyor ve
// `senaryo.test.ts` botu gercekten oynatarak dogruluyor — `bot.ts`te bir ayar
// degisip ogreticiyi bozarsa orada patliyor.

import {
  desteOlustur,
  normalTas,
  okeyTas,
  type Kopya,
  type OyuncuId,
  type Renk,
  type Sayi,
  type Tas,
} from '@kut/engine';

/** Kullanicinin koltugu — alistirma masasinda insan hep 0 numarali. */
export const OGRENCI: OyuncuId = 0;

const t = (renk: Renk, sayi: Sayi, kopya: Kopya = 'a'): Tas => normalTas(renk, sayi, kopya);

/** Kullanicinin acilis kutleri — tur 1'in sarti: 2 x uclu kut. */
export const ACILIS_KUTLERI = {
  yediler: [t('kirmizi', 7), t('mavi', 7), t('siyah', 7)],
  dortler: [t('kirmizi', 4), t('mavi', 4), t('sari', 4)],
} as const;

/**
 * Acildiktan sonra YER TUTUCUNUN kutune islenecek tas.
 *
 * Once `sari7` idi ve bu bir TUZAKTI: kullanicinin acilis kutu `kirmizi7 +
 * mavi7 + siyah7`, dordunculuk rengi de sari. KÜT DİZ dort yediyi tek grup
 * yapiyor, kullanici dordunu birden seciyor ve tur 1'in "UCLU kut" sartina
 * takiliyor (§6 "ne eksik, ne fazla"). Canli oynanista bu gercekten oldu.
 *
 * Simdi 3 numaralinin `kirmizi11 + mavi11 + siyah11` kutunu tamamliyor:
 * acilis kutleriyle hicbir sekilde gruplanmiyor ve ustelik BASKASININ perine
 * isleme yapmayi ogretiyor (§6).
 */
export const ISLENECEK_TAS = t('sari', 11);

/** 3 numaralinin kutundeki okeyi almak icin gereken iki tas (§6). */
export const OKEY_TAMAMLAYICILARI = [t('siyah', 5), t('sari', 5)] as const;

/** 2 numaralinin atacagi, kullanicinin calacagi tas. */
export const CALINACAK_TAS = t('siyah', 9);

/** Calinan tasin ise yaramasi icin kullanicinin elinde duranlar. */
const CALMAYI_ANLAMLI_KILANLAR = [t('kirmizi', 9), t('mavi', 9)];

/** 3 numaralinin acilisi: biri okeyli, ikisi de UCLU kut (§6 "ne eksik ne fazla"). */
export const YER_TUTUCU_ACILISI = {
  besler: [t('kirmizi', 5), t('mavi', 5), okeyTas('a')],
  onbirler: [t('kirmizi', 11), t('mavi', 11), t('siyah', 11)],
} as const;

/**
 * Kullanicinin elindeki, ogretmeye yaramayan taslar.
 *
 * Elle secildi: birbirleriyle per KURMAMALILAR, yoksa "hangi taslari
 * secmeliyim" adimi bulaniklasir ve `TAŞLARI İŞLE` beklenmedik tas gonderir.
 */
export const OGRENCI_DOLGUSU = [t('mavi', 1), t('siyah', 13), t('sari', 2), t('kirmizi', 12)];

/**
 * Destenin ILK tasi — kullanicinin ilk atisindan sonra 3 numarali bunu cekiyor.
 *
 * Dagitimin kendiliginden verdigi ilk tas `mavi6` idi ve ogreticiyi
 * BOZUYORDU: 3 numaralinin dolgusunda `sari6 + kirmizi6` var, ucuncu 6
 * gelince okeysiz bir 6-6-6 kuruluyor ve bot okeyi saklamak icin onu
 * aciyordu (`acilisBul`: okey kit kaynak, okeysiz cozum once). Yerde okeyli
 * kut olmayinca "OKEY AL" adimi yapilamiyordu. Kullanici botun isine yarayan
 * bir tas attiginda (mavi1, sari2) bot desteden cekmeyip onu aldigi icin
 * dogru aciyordu — hata, hangi tasin atildigina bagliydi.
 *
 * `sari1` 3 numaraliya okeysiz hicbir acilis kazandirmiyor (elinde tek 1 var).
 * Destenin SONUNDAKI tasla yer degistiriyor: yalnizca iki konum oynuyor,
 * sonraki cekisler ve ogreticinin geri kalan akisi aynen kaliyor.
 */
export const ILK_CEKILEN_TAS = t('sari', 1);

const OGRENCI_ELI: readonly Tas[] = [
  ...ACILIS_KUTLERI.yediler,
  ...ACILIS_KUTLERI.dortler,
  ISLENECEK_TAS,
  ...OKEY_TAMAMLAYICILARI,
  ...CALMAYI_ANLAMLI_KILANLAR,
  ...OGRENCI_DOLGUSU,
];

const UC_NUMARALI_ELI: readonly Tas[] = [
  ...YER_TUTUCU_ACILISI.besler,
  ...YER_TUTUCU_ACILISI.onbirler,
];

const IKI_NUMARALI_ELI: readonly Tas[] = [CALINACAK_TAS];

const BIR_NUMARALI_ELI: readonly Tas[] = [];

/** KURALLAR.md §1 — baslayana 15, digerlerine 14. */
const BASLAYAN_ADEDI = 15;
const NORMAL_ADET = 14;

/**
 * Dolgu taslarini DAGITIR — ardisik olanlar ayni ele dusmesin.
 *
 * `desteOlustur` taslari renk renk, sayi sirasiyla uretiyor. Dolgu bu siradan
 * pesi sira alininca her ele bir renk BLOGU gidiyordu ve sonuc felaketti:
 * 3 numarali `K1 K1 K2 K2 K3 K3 K4 K5`, 2 numarali `K6..K13`, 1 numarali
 * `S1..S9` aliyordu. Uc yer tutucu da devasa serilerle oturuyor, el 16
 * hamlede bitiyordu — ogretici daha yarisina gelmeden birisi eli goturuyordu.
 *
 * Adim, kalan sayiyla aralarinda asal secilirse dizinin tamami bir kez
 * geziliyor; ardisik taslar birbirinden uzaga dusuyor. Rastgelelik yok,
 * cikti yine tamamen belirlenimli (motor kurali #2).
 */
const DAGITIM_ADIMI = 23;

function dagit(taslar: readonly Tas[]): readonly Tas[] {
  const sonuc: Tas[] = [];
  for (let sayac = 0; sayac < taslar.length; sayac += 1) {
    sonuc.push(taslar[(sayac * DAGITIM_ADIMI) % taslar.length] as Tas);
  }
  return sonuc;
}

/**
 * Senaryonun destesi — DAGITIM SIRASINDA.
 *
 * `elKur` desteyi sirayla dagitiyor: once baslayan (15), sonra oyun yonunde
 * digerleri (14'er), kalani deste. Bu fonksiyon o sirayi kuruyor.
 *
 * Belirlenen taslar disindaki her yer, destenin geri kalanindan SIRAYLA
 * dolduruluyor — boylece hangi tasin nereye gittigi belirlenimli kaliyor ve
 * senaryo testi bunu bastan sona dogruluyor.
 */
export function ogreticiDestesi(): readonly Tas[] {
  const secilenler = new Set(
    [...OGRENCI_ELI, ...UC_NUMARALI_ELI, ...IKI_NUMARALI_ELI, ...BIR_NUMARALI_ELI].map(
      (tas) => tas.id,
    ),
  );
  const kalanlar = dagit(desteOlustur().filter((tas) => !secilenler.has(tas.id)));

  let sonraki = 0;
  const doldur = (temel: readonly Tas[], adet: number): readonly Tas[] => {
    const eksik = adet - temel.length;
    const dolgu = kalanlar.slice(sonraki, sonraki + eksik);
    sonraki += eksik;
    return [...temel, ...dolgu];
  };

  // Dagitim sirasi: baslayan (0), sonra siradaIleri yonunde 3, 2, 1.
  const eller = [
    doldur(OGRENCI_ELI, BASLAYAN_ADEDI),
    doldur(UC_NUMARALI_ELI, NORMAL_ADET),
    doldur(IKI_NUMARALI_ELI, NORMAL_ADET),
    doldur(BIR_NUMARALI_ELI, NORMAL_ADET),
  ];

  const deste = [...kalanlar.slice(sonraki)];
  const indeks = deste.findIndex((tas) => tas.id === ILK_CEKILEN_TAS.id);
  if (indeks > 0) {
    [deste[0], deste[indeks]] = [deste[indeks] as Tas, deste[0] as Tas];
  }
  return [...eller.flat(), ...deste];
}
