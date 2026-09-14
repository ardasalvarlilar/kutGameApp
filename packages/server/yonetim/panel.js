// Kut yonetim paneli.
//
// Derleme adimi yok, kutuphane yok: tek dosya, tarayicinin kendi DOM'u.
//
// GUVENLIK — oyuncu adlari, sikayet aciklamalari oyuncudan geliyor. Hicbiri
// `innerHTML` ile basilmiyor; `el()` yardimcisi metni HER ZAMAN metin dugumu
// olarak ekliyor. "<img onerror=...>" adli bir oyuncu panelde kod calistiramaz.
//
// Oturum: jeton `sessionStorage`da — sekme kapaninca gidiyor. Asil kapi
// sunucuda (admin rolu her istekte veritabanindan okunuyor).

'use strict';

const JETON_ANAHTARI = 'kut.yonetim.jeton';

const HATALAR = {
  'yetki-yok': 'Bu hesabın yönetici yetkisi yok.',
  'jeton-gecersiz': 'Oturumun süresi doldu, yeniden giriş yap.',
  'jeton-gerekli': 'Giriş yapmalısın.',
  'eposta-parola-hatali': 'E-posta ya da parola hatalı.',
  'hesap-askida': 'Bu hesap askıya alınmış.',
  'kendine-yapilamaz': 'Bu işlemi kendi hesabına yapamazsın.',
  'kurucu-korunuyor': 'Kurucu hesabına bu işlem yapılamaz.',
  'misafire-yetki-verilemez': 'Misafir hesaba yönetici yetkisi verilemez (e-postası ve parolası yok).',
  'oyuncu-bulunamadi': 'Oyuncu bulunamadı (silinmiş olabilir).',
  'sikayet-bulunamadi': 'Şikâyet bulunamadı.',
  'cip-yetersiz': 'Oyuncunun bakiyesi bu kadar çip çıkarmaya yetmiyor.',
  'ad-gecersiz': 'Bu ad kullanılamaz (2–24 karakter, uygunsuz kelime içermemeli).',
  'gecersiz-istek': 'Girdi geçersiz. Gerekçe en az 3 karakter olmalı.',
  'sunucu-hatasi': 'Sunucuda bir hata oldu.',
};

const CIP_SEBEPLERI = {
  baslangic: 'başlangıç',
  'masa-giris': 'masa girişi',
  'masa-odulu': 'masa ödülü',
  'masa-iadesi': 'masa iadesi',
  'satin-alma': 'satın alma',
  hediye: 'hediye',
  'reklam-odulu': 'reklam ödülü',
  yonetici: 'yönetici',
};

const SIKAYET_SEBEPLERI = {
  'uygunsuz-ad': 'Uygunsuz ad',
  taciz: 'Taciz / hakaret',
  hile: 'Hile',
  'oyunu-bozma': 'Oyunu bozma',
  diger: 'Diğer',
};

const SIKAYET_DURUMLARI = { yeni: 'Yeni', incelendi: 'İncelendi', 'islem-yapildi': 'İşlem yapıldı' };

const ISLEMLER = {
  cip: 'Çip',
  duzenle: 'Düzenleme',
  'askiya-al': 'Askıya alma',
  'askidan-cikar': 'Askıdan çıkarma',
  sil: 'Silme',
  sikayet: 'Şikâyet',
};

let jeton = sessionStorage.getItem(JETON_ANAHTARI);
let ben = null;
let sekme = 'genel';
const kok = document.getElementById('kok');

// --- Yardimcilar -------------------------------------------------------------

/** Guvenli eleman kurucu: cocuk metinler HER ZAMAN metin dugumu. */
function el(etiket, ozellikler, ...cocuklar) {
  const d = document.createElement(etiket);
  for (const [ad, deger] of Object.entries(ozellikler || {})) {
    if (deger === undefined || deger === null || deger === false) continue;
    if (ad === 'class') d.className = deger;
    else if (ad.startsWith('on')) d.addEventListener(ad.slice(2), deger);
    else if (ad === 'value') d.value = deger;
    else d.setAttribute(ad, deger === true ? '' : String(deger));
  }
  for (const cocuk of cocuklar.flat()) {
    if (cocuk === null || cocuk === undefined || cocuk === false) continue;
    d.append(cocuk instanceof Node ? cocuk : document.createTextNode(String(cocuk)));
  }
  return d;
}

const sayi = (n) => Number(n).toLocaleString('tr-TR');
const zaman = (iso) =>
  iso ? new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const hataMetni = (kod) => HATALAR[kod] || kod;

class ApiHatasi extends Error {}

async function istek(yontem, yol, govde) {
  const basliklar = {};
  if (govde !== undefined) basliklar['content-type'] = 'application/json';
  if (jeton) basliklar.authorization = 'Bearer ' + jeton;

  let veri;
  try {
    const yanit = await fetch('/api' + yol, {
      method: yontem,
      headers: basliklar,
      body: govde === undefined ? undefined : JSON.stringify(govde),
    });
    veri = await yanit.json();
  } catch {
    throw new ApiHatasi('Sunucuya ulaşılamadı.');
  }
  if (!veri.ok) {
    // Oturum gecersizlesti ya da yetki alindi: panelde kalmanin anlami yok.
    if (['jeton-gecersiz', 'jeton-gerekli', 'yetki-yok'].includes(veri.hata) && ben !== null) {
      cikis(hataMetni(veri.hata));
    }
    throw new ApiHatasi(hataMetni(veri.hata));
  }
  return veri.veri;
}

function mesaj(tur, metin) {
  return el('div', { class: 'mesaj ' + tur }, metin);
}

/** Bir kutuyu yukleme sirasinda "yukleniyor", hatada mesajla doldurur. */
async function doldur(kap, is) {
  kap.replaceChildren(el('p', { class: 'solgun' }, 'Yükleniyor…'));
  try {
    kap.replaceChildren(await is());
  } catch (hata) {
    kap.replaceChildren(mesaj('hata', hata.message));
  }
}

// --- Giris ------------------------------------------------------------------

function cikis(neden) {
  jeton = null;
  ben = null;
  sessionStorage.removeItem(JETON_ANAHTARI);
  girisEkrani(neden);
}

function girisEkrani(neden) {
  const eposta = el('input', { type: 'email', autocomplete: 'username', required: true });
  const parola = el('input', { type: 'password', autocomplete: 'current-password', required: true });
  const durum = el('div');
  if (neden) durum.append(mesaj('hata', neden));

  const form = el(
    'form',
    {
      class: 'giris',
      onsubmit: async (olay) => {
        olay.preventDefault();
        durum.replaceChildren();
        try {
          const giris = await istek('POST', '/kimlik/giris', {
            eposta: eposta.value.trim(),
            parola: parola.value,
          });
          jeton = giris.jeton;
          ben = await istek('GET', '/yonetim/ben');
          sessionStorage.setItem(JETON_ANAHTARI, jeton);
          anaEkran();
        } catch (hata) {
          jeton = null;
          durum.replaceChildren(mesaj('hata', hata.message));
        }
      },
    },
    el('div', { class: 'marka' }, 'KÜT'),
    el('div', { class: 'solgun' }, 'Yönetim paneli'),
    durum,
    el('label', {}, 'E-POSTA'),
    eposta,
    el('label', {}, 'PAROLA'),
    parola,
    el('button', { class: 'vurgu', type: 'submit' }, 'GİRİŞ YAP'),
  );
  kok.replaceChildren(form);
  eposta.focus();
}

// --- Ana ekran --------------------------------------------------------------

const SEKMELER = [
  ['genel', 'Genel'],
  ['oyuncular', 'Oyuncular'],
  ['sikayetler', 'Şikâyetler'],
  ['kayitlar', 'İşlem kaydı'],
];

let icerik;

function anaEkran() {
  icerik = el('main');
  const sekmeler = el(
    'nav',
    { class: 'sekmeler' },
    SEKMELER.map(([kimlik, ad]) =>
      el('button', { class: sekme === kimlik ? 'acik' : '', onclick: () => sekmeyeGec(kimlik) }, ad),
    ),
  );
  kok.replaceChildren(
    el(
      'header',
      { class: 'ust' },
      el('div', { class: 'marka' }, 'KÜT'),
      sekmeler,
      el('div', { class: 'bosluk' }),
      el('span', { class: 'solgun' }, ben.ad, ben.eposta ? ' · ' + ben.eposta : ''),
      el('button', { onclick: () => cikis() }, 'ÇIKIŞ'),
    ),
    icerik,
  );
  sekmeyeGec(sekme);
}

function sekmeyeGec(kimlik) {
  sekme = kimlik;
  for (const dugme of kok.querySelectorAll('.sekmeler button')) {
    dugme.classList.toggle('acik', dugme.textContent === SEKMELER.find((s) => s[0] === kimlik)[1]);
  }
  if (kimlik === 'genel') genelSekmesi();
  else if (kimlik === 'oyuncular') oyuncularSekmesi();
  else if (kimlik === 'sikayetler') sikayetlerSekmesi();
  else kayitlarSekmesi();
}

function kart(deger, etiket) {
  return el('div', { class: 'kart' }, el('div', { class: 'deger' }, deger), el('div', { class: 'etiket' }, etiket));
}

// --- Genel ------------------------------------------------------------------

function genelSekmesi() {
  doldur(icerik, async () => {
    const o = await istek('GET', '/yonetim/ozet');
    const c = o.son24SaatCip;
    return el(
      'div',
      {},
      el('h2', {}, 'OYUNCULAR'),
      el(
        'div',
        { class: 'kartlar' },
        kart(sayi(o.oyuncular.toplam), 'toplam hesap'),
        kart(sayi(o.oyuncular.kayitli), 'e-postalı'),
        kart(sayi(o.oyuncular.misafir), 'misafir'),
        kart(sayi(o.son24Saat.gorulen), 'son 24 saatte görülen'),
        kart(sayi(o.son24Saat.yeniHesap), 'son 24 saatte açılan'),
        kart(sayi(o.oyuncular.askida), 'askıda'),
        kart(sayi(o.oyuncular.admin), 'yönetici'),
      ),
      el('h2', {}, 'MASALAR VE ŞİKÂYETLER'),
      el(
        'div',
        { class: 'kartlar' },
        kart(sayi(o.masalar.oynaniyor), 'oynanan masa'),
        kart(sayi(o.masalar.bekliyor), 'bekleyen masa'),
        kart(sayi(o.yeniSikayet), 'bakılmamış şikâyet'),
      ),
      el('h2', {}, 'ÇİP (SON 24 SAAT)'),
      el(
        'div',
        { class: 'kartlar' },
        kart(sayi(o.dolasimdakiCip), 'dolaşımdaki toplam çip'),
        kart(sayi(c.masaUcreti), 'masa ücreti (yaklaşık)'),
        kart(sayi(c.girisler), 'masa girişleri'),
        kart(sayi(c.oduller), 'dağıtılan ödül'),
        kart(sayi(c.iadeler), 'iade'),
        kart(sayi(c.hediye), 'hediye çip'),
        kart(sayi(c.reklam), 'reklam ödülü'),
        kart(sayi(c.baslangic), 'başlangıç çipi'),
        kart(sayi(c.yonetici), 'yönetici ekledi / çıkardı'),
      ),
    );
  });
}

// --- Oyuncular --------------------------------------------------------------

function etiketler(o) {
  return el(
    'span',
    { class: 'etiketler' },
    o.kurucu ? el('span', { class: 'admin' }, 'KURUCU') : o.rol === 'admin' ? el('span', { class: 'admin' }, 'YÖNETİCİ') : null,
    o.askida ? el('span', { class: 'askida' }, 'ASKIDA') : null,
    o.misafirMi ? el('span', {}, 'MİSAFİR') : null,
  );
}

function oyuncularSekmesi(ara = '', sayfa = 0) {
  const kutu = el('input', {
    placeholder: 'Ad, e-posta, arkadaş kodu (KUT-…) ya da kimlik',
    value: ara,
    onkeydown: (olay) => {
      if (olay.key === 'Enter') oyuncularSekmesi(kutu.value, 0);
    },
  });
  const liste = el('div');
  icerik.replaceChildren(
    el('div', { class: 'arac' }, kutu, el('button', { class: 'vurgu', onclick: () => oyuncularSekmesi(kutu.value, 0) }, 'ARA')),
    liste,
  );
  kutu.focus();

  doldur(liste, async () => {
    const s = await istek('GET', '/yonetim/oyuncular?ara=' + encodeURIComponent(ara) + '&sayfa=' + sayfa);
    const satirlar = s.oyuncular.map((o) =>
      el(
        'tr',
        { class: 'tikla', onclick: () => oyuncuAyrintisi(o.id) },
        el('td', {}, o.ad, ' ', etiketler(o)),
        el('td', { class: 'solgun' }, o.eposta || '—'),
        el('td', { class: 'sayi' }, sayi(o.cip)),
        el('td', { class: 'sayi' }, o.seviye),
        el('td', { class: 'solgun' }, zaman(o.sonGorulme)),
      ),
    );
    const sayfaSayisi = Math.max(1, Math.ceil(s.toplam / s.sayfaBoyu));
    return el(
      'div',
      {},
      el(
        'div',
        { class: 'tablo-kap' },
        el(
          'table',
          {},
          el('thead', {}, el('tr', {}, el('th', {}, 'AD'), el('th', {}, 'E-POSTA'), el('th', { class: 'sayi' }, 'ÇİP'), el('th', { class: 'sayi' }, 'SV.'), el('th', {}, 'SON GÖRÜLME'))),
          el('tbody', {}, satirlar),
        ),
      ),
      el(
        'div',
        { class: 'arac' },
        el('span', { class: 'solgun' }, sayi(s.toplam) + ' oyuncu · sayfa ' + (sayfa + 1) + '/' + sayfaSayisi),
        el('button', { disabled: sayfa === 0, onclick: () => oyuncularSekmesi(ara, sayfa - 1) }, '‹ ÖNCEKİ'),
        el('button', { disabled: sayfa + 1 >= sayfaSayisi, onclick: () => oyuncularSekmesi(ara, sayfa + 1) }, 'SONRAKİ ›'),
      ),
    );
  });
}

function oyuncuAyrintisi(id, bildiri) {
  sekme = 'oyuncular';
  doldur(icerik, async () => {
    const o = await istek('GET', '/yonetim/oyuncular/' + encodeURIComponent(id));
    const ustBildiri = el('div');
    if (bildiri) ustBildiri.append(mesaj(bildiri[0], bildiri[1]));

    /** Islem yapip ayrintiyi tazeleyen ortak kalip. */
    const yap = async (is, basari) => {
      try {
        await is();
        oyuncuAyrintisi(id, ['tamam', basari]);
      } catch (hata) {
        ustBildiri.replaceChildren(mesaj('hata', hata.message));
        window.scrollTo(0, 0);
      }
    };

    // --- Cip
    const miktar = el('input', { type: 'number', step: '1000', placeholder: 'Miktar (ör. 50000 ya da -5000)' });
    const cipNotu = el('input', { placeholder: 'Gerekçe (defterde görünür)', maxlength: '200' });
    const cipKutusu = el(
      'div',
      { class: 'kutu' },
      el('h3', {}, 'ÇİP'),
      el('div', { class: 'deger' }, el('strong', {}, sayi(o.cip)), ' çip'),
      el('div', { class: 'satir' }, miktar),
      el('div', { class: 'satir' }, cipNotu),
      el(
        'div',
        { class: 'satir' },
        el('button', {
          class: 'vurgu',
          onclick: () => {
            const m = Math.trunc(Number(miktar.value));
            if (!m) return ustBildiri.replaceChildren(mesaj('hata', 'Sıfırdan farklı bir miktar yaz.'));
            if (!window.confirm((m > 0 ? '+' : '') + sayi(m) + ' çip — ' + o.ad + '. Onaylıyor musun?')) return;
            yap(
              () => istek('POST', '/yonetim/oyuncular/' + id + '/cip', { miktar: m, aciklama: cipNotu.value }),
              'Çip güncellendi.',
            );
          },
        }, 'UYGULA'),
      ),
    );

    // --- Duzenleme
    const ad = el('input', { value: o.ad, maxlength: '24' });
    const rol = el(
      'select',
      { disabled: o.kurucu },
      el('option', { value: 'oyuncu' }, 'Oyuncu'),
      el('option', { value: 'admin' }, 'Yönetici'),
    );
    rol.value = o.rol;
    const deneyim = el('input', { type: 'number', min: '0', value: String(o.deneyim) });
    const duzenKutusu = el(
      'div',
      { class: 'kutu' },
      el('h3', {}, 'DÜZENLE'),
      el('label', { class: 'solgun' }, 'Görünen ad'),
      ad,
      el('label', { class: 'solgun' }, 'Rol' + (o.kurucu ? ' (kurucu — değiştirilemez)' : '')),
      rol,
      el('label', { class: 'solgun' }, 'Deneyim (seviye bundan hesaplanır)'),
      deneyim,
      el(
        'div',
        { class: 'satir' },
        el('button', {
          class: 'vurgu',
          onclick: () =>
            yap(
              () =>
                istek('PATCH', '/yonetim/oyuncular/' + id, {
                  ad: ad.value,
                  rol: rol.value,
                  deneyim: Math.max(0, Math.trunc(Number(deneyim.value) || 0)),
                }),
              'Kaydedildi.',
            ),
        }, 'KAYDET'),
      ),
    );

    // --- Aski ve silme
    const tehlikeKutusu = el(
      'div',
      { class: 'kutu' },
      el('h3', {}, 'HESAP'),
      el('p', { class: 'solgun' }, 'Askıya alınan oyuncu masaya oturamaz ve açık bağlantısı hemen kesilir. Silme geri alınamaz; oyuncunun kendi silmesiyle aynıdır.'),
      el(
        'div',
        { class: 'satir' },
        el('button', {
          class: o.askida ? 'onay' : 'tehlike',
          onclick: () => {
            const sebep = window.prompt(o.askida ? 'Askıdan çıkarma gerekçesi:' : 'Askıya alma gerekçesi:');
            if (sebep === null) return;
            yap(
              () => istek('POST', '/yonetim/oyuncular/' + id + '/aski', { askida: !o.askida, sebep }),
              o.askida ? 'Askıdan çıkarıldı.' : 'Askıya alındı.',
            );
          },
        }, o.askida ? 'ASKIDAN ÇIKAR' : 'ASKIYA AL'),
        el('button', {
          class: 'tehlike',
          onclick: async () => {
            const onay = window.prompt('Silmek için oyuncunun adını aynen yaz: ' + o.ad);
            if (onay === null) return;
            if (onay.trim() !== o.ad) return ustBildiri.replaceChildren(mesaj('hata', 'Ad eşleşmedi; silinmedi.'));
            const sebep = window.prompt('Silme gerekçesi:');
            if (sebep === null) return;
            try {
              await istek('DELETE', '/yonetim/oyuncular/' + id, { sebep });
              oyuncularSekmesi();
              icerik.prepend(mesaj('tamam', o.ad + ' silindi.'));
            } catch (hata) {
              ustBildiri.replaceChildren(mesaj('hata', hata.message));
            }
          },
        }, 'HESABI SİL'),
      ),
    );

    const bilgi = el(
      'dl',
      { class: 'bilgi' },
      [
        ['Kimlik', o.id],
        ['E-posta', o.eposta || '—'],
        ['Giriş yolu', o.girisYollari.join(', ')],
        ['Arkadaş kodu', o.arkadasKodu || '—'],
        ['Seviye', o.seviye + ' (' + sayi(o.deneyim) + ' XP)'],
        ['Maç', o.istatistik.kazanilanMac + ' / ' + o.istatistik.oynananMac + ' kazanıldı'],
        ['El', o.istatistik.kazanilanEl + ' / ' + o.istatistik.oynananEl + ' kazanıldı'],
        ['Açılış', zaman(o.acilis)],
        ['Son görülme', zaman(o.sonGorulme)],
        ['Masa', o.masa ? o.masa.kod + ' · ' + o.masa.durum + ' · ' + o.masa.kademe + ' · tur ' + o.masa.tur : '—'],
        ['Engellediği', o.engelledigiSayisi + ' oyuncu'],
      ].flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v)]),
    );

    const defter = el(
      'div',
      { class: 'tablo-kap' },
      el(
        'table',
        {},
        el('thead', {}, el('tr', {}, el('th', {}, 'ZAMAN'), el('th', {}, 'SEBEP'), el('th', { class: 'sayi' }, 'MİKTAR'), el('th', { class: 'sayi' }, 'BAKİYE'), el('th', {}, 'NOT'))),
        el(
          'tbody',
          {},
          o.defter.map((h) =>
            el(
              'tr',
              {},
              el('td', { class: 'solgun' }, zaman(h.zaman)),
              el('td', {}, CIP_SEBEPLERI[h.sebep] || h.sebep),
              el('td', { class: 'sayi ' + (h.miktar >= 0 ? 'arti' : 'eksi') }, (h.miktar > 0 ? '+' : '') + sayi(h.miktar)),
              el('td', { class: 'sayi' }, sayi(h.bakiye)),
              el('td', { class: 'solgun' }, h.aciklama || ''),
            ),
          ),
        ),
      ),
    );

    return el(
      'div',
      {},
      el('div', { class: 'arac' }, el('button', { onclick: () => oyuncularSekmesi() }, '‹ LİSTE'), el('h2', { style: 'margin:0' }, o.ad), etiketler(o)),
      ustBildiri,
      el(
        'div',
        { class: 'ayrinti' },
        el('div', { class: 'kutu' }, el('h3', {}, 'BİLGİ'), bilgi),
        cipKutusu,
        duzenKutusu,
        tehlikeKutusu,
      ),
      el('h2', {}, 'ÇİP DEFTERİ (SON 50)'),
      o.defter.length ? defter : el('p', { class: 'solgun' }, 'Hareket yok.'),
      el('h2', {}, 'HAKKINDAKİ ŞİKÂYETLER'),
      o.sikayetler.length
        ? el(
            'ul',
            {},
            o.sikayetler.map((s) =>
              el('li', {}, zaman(s.zaman), ' · ', SIKAYET_SEBEPLERI[s.sebep] || s.sebep, ' · ', s.eden, ' · ', SIKAYET_DURUMLARI[s.durum], s.aciklama ? ' — “' + s.aciklama + '”' : ''),
            ),
          )
        : el('p', { class: 'solgun' }, 'Şikâyet yok.'),
      el('h2', {}, 'YÖNETİM İŞLEMLERİ'),
      o.islemler.length
        ? el('ul', {}, o.islemler.map((k) => el('li', {}, zaman(k.zaman), ' · ', k.yonetici, ' · ', ISLEMLER[k.islem] || k.islem, ' — ', k.ayrinti)))
        : el('p', { class: 'solgun' }, 'İşlem yok.'),
    );
  });
}

// --- Sikayetler -------------------------------------------------------------

function sikayetlerSekmesi(durum = 'yeni') {
  const secim = el(
    'select',
    { onchange: () => sikayetlerSekmesi(secim.value) },
    el('option', { value: 'yeni' }, 'Yeni'),
    el('option', { value: 'incelendi' }, 'İncelendi'),
    el('option', { value: 'islem-yapildi' }, 'İşlem yapıldı'),
    el('option', { value: '' }, 'Hepsi'),
  );
  secim.value = durum;
  const liste = el('div');
  icerik.replaceChildren(el('div', { class: 'arac' }, el('span', { class: 'solgun' }, 'Durum:'), secim), liste);

  doldur(liste, async () => {
    const sikayetler = await istek('GET', '/yonetim/sikayetler' + (durum ? '?durum=' + durum : ''));
    if (sikayetler.length === 0) return el('p', { class: 'solgun' }, 'Bu durumda şikâyet yok.');
    const degistir = async (s, yeni) => {
      try {
        await istek('PATCH', '/yonetim/sikayetler/' + s.id, { durum: yeni });
        sikayetlerSekmesi(durum);
      } catch (hata) {
        liste.prepend(mesaj('hata', hata.message));
      }
    };
    return el(
      'div',
      { class: 'tablo-kap' },
      el(
        'table',
        {},
        el('thead', {}, el('tr', {}, el('th', {}, 'ZAMAN'), el('th', {}, 'ŞİKÂYET EDİLEN'), el('th', {}, 'EDEN'), el('th', {}, 'SEBEP'), el('th', {}, 'AÇIKLAMA'), el('th', {}, 'DURUM'), el('th', {}, ''))),
        el(
          'tbody',
          {},
          sikayetler.map((s) =>
            el(
              'tr',
              {},
              el('td', { class: 'solgun' }, zaman(s.zaman)),
              el('td', {}, el('a', { onclick: () => oyuncuAyrintisi(s.edilenId) }, s.edilen), s.oAndakiAd !== s.edilen ? el('div', { class: 'solgun' }, 'o andaki adı: ' + s.oAndakiAd) : null),
              el('td', {}, el('a', { onclick: () => oyuncuAyrintisi(s.edenId) }, s.eden)),
              el('td', {}, SIKAYET_SEBEPLERI[s.sebep] || s.sebep),
              el('td', { class: 'solgun' }, s.aciklama || '—'),
              el('td', {}, SIKAYET_DURUMLARI[s.durum]),
              el(
                'td',
                {},
                el('div', { class: 'satir' },
                  s.durum !== 'incelendi' ? el('button', { onclick: () => degistir(s, 'incelendi') }, 'İNCELENDİ') : null,
                  s.durum !== 'islem-yapildi' ? el('button', { class: 'onay', onclick: () => degistir(s, 'islem-yapildi') }, 'İŞLEM YAPILDI') : null,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
}

// --- Islem kaydi ------------------------------------------------------------

function kayitlarSekmesi() {
  doldur(icerik, async () => {
    const kayitlar = await istek('GET', '/yonetim/kayitlar');
    if (kayitlar.length === 0) return el('p', { class: 'solgun' }, 'Henüz yönetim işlemi yok.');
    return el(
      'div',
      { class: 'tablo-kap' },
      el(
        'table',
        {},
        el('thead', {}, el('tr', {}, el('th', {}, 'ZAMAN'), el('th', {}, 'YÖNETİCİ'), el('th', {}, 'İŞLEM'), el('th', {}, 'OYUNCU'), el('th', {}, 'AYRINTI'))),
        el(
          'tbody',
          {},
          kayitlar.map((k) =>
            el(
              'tr',
              {},
              el('td', { class: 'solgun' }, zaman(k.zaman)),
              el('td', {}, k.yonetici),
              el('td', {}, ISLEMLER[k.islem] || k.islem),
              el('td', {}, k.hedefId ? el('a', { onclick: () => oyuncuAyrintisi(k.hedefId) }, k.hedef) : '—'),
              el('td', { class: 'solgun' }, k.ayrinti),
            ),
          ),
        ),
      ),
    );
  });
}

// --- Acilis -----------------------------------------------------------------

(async () => {
  if (!jeton) return girisEkrani();
  try {
    ben = await istek('GET', '/yonetim/ben');
    anaEkran();
  } catch (hata) {
    cikis(hata.message);
  }
})();
