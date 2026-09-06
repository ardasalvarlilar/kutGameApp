// Push bildirimi — izin, jeton ve sunucuya kayit.
//
// Bu dosyanin tek isi CIHAZI KAYDETMEK: izni iste, Expo'dan jetonu al,
// sunucuya yolla. Hangi olayin bildirim doguracagi sunucunun karari
// (packages/server/src/servisler/bildirimServisi.ts).
//
// UC SEY BILINCLI:
//
//  1. Hicbir sey FIRLATMIYOR. Bildirim, oyunun calismasi icin sart degil
//     (App Store 4.5.4 de bunu istiyor). Izin reddedilirse, cihaz
//     desteklemiyorsa ya da sunucu ulasilmazsa uygulama hicbir sey olmamis
//     gibi devam eder.
//  2. Izin BIR KEZ sorulur. iOS'ta reddedilen izin bir daha sorulamaz —
//     sistem penceresi bir daha acilmaz, oyuncunun Ayarlar'a gitmesi gerekir.
//     Bu yuzden `getPermissionsAsync` ile once bakiliyor, gerekmiyorsa
//     istenmiyor.
//  3. Emulator/simulator jeton VERMEZ. `Device.isDevice` kontrolu olmadan
//     gelistirmede her acilista anlamsiz bir hata aliniyor.
//
// NOT: iOS'ta push, Expo Go icinde CALISMAZ (SDK 53'ten beri). Denemek icin
// EAS ile alinmis bir yapi (development ya da production) gerekiyor.

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as api from './api';

/** Sunucunun bekledigi platform adi. */
export type BildirimPlatformu = 'ios' | 'android' | 'web';

function platformAdi(): BildirimPlatformu {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

/**
 * Uygulama ON PLANDAYKEN gelen bildirim ne olsun?
 *
 * Banner GOSTERILMIYOR: oyuncu zaten uygulamanin icinde. Ekranin ustune
 * dusen bir bildirim, masadaki taslarin onunu kapatir ve zaten gordugu bir
 * seyi haber verir. Uygulama ici olaylar bildirimle degil, ekranda
 * gosterilir.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** EAS proje kimligi — jeton almak icin sart. */
function projeKimligi(): string | null {
  const eas = Constants.expoConfig?.extra?.['eas'] as { projectId?: string } | undefined;
  return eas?.projectId ?? null;
}

/**
 * Android'de bildirimler bir KANALA dusmek zorunda; kanal yoksa sessizce
 * gorunmuyorlar. iOS'ta karsiligi yok, cagri zararsiz.
 */
async function kanaliKur(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Oyun bildirimleri',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
  });
}

/**
 * Izni ister ve cihazin jetonunu dondurur. Alinamazsa null.
 *
 * `zorla` false ise yalnizca DAHA ONCE karar verilmemisse sorar; iOS'ta
 * reddedilen izin bir daha sorulamadigi icin bosuna cagri yapmiyoruz.
 */
export async function bildirimJetonuAl(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const proje = projeKimligi();
  if (proje === null) return null;

  try {
    await kanaliKur();

    const mevcut = await Notifications.getPermissionsAsync();
    let izin = mevcut.status;
    // `canAskAgain` false ise sistem penceresi zaten acilmayacak.
    if (izin !== 'granted' && mevcut.canAskAgain) {
      izin = (await Notifications.requestPermissionsAsync()).status;
    }
    if (izin !== 'granted') return null;

    const jeton = await Notifications.getExpoPushTokenAsync({ projectId: proje });
    return jeton.data;
  } catch {
    // Kural #1 — bildirim kurulamadi diye uygulama durmaz.
    return null;
  }
}

/**
 * Izni alir ve cihazi sunucuya kaydeder.
 *
 * Oturum jetonu SART: bildirim jetonu bir oyuncuya baglaniyor. Bu yuzden
 * oturum kurulduktan sonra cagriliyor (bkz. ag/kimlik.tsx).
 */
export async function cihaziKaydet(oturumJetonu: string): Promise<boolean> {
  const jeton = await bildirimJetonuAl();
  if (jeton === null) return false;

  const sonuc = await api.bildirimJetonuKaydet(oturumJetonu, jeton, platformAdi());
  return sonuc.ok;
}

/**
 * Cikis yaparken cihazi kayittan dusurur.
 *
 * Olmazsa: cikis yapan oyuncunun telefonu, sonraki bildirimleri ALMAYA DEVAM
 * ederdi — baskasinin oyun bilgisi yabancinin kilit ekraninda gorunurdu.
 */
export async function cihaziDusur(oturumJetonu: string): Promise<void> {
  const jeton = await bildirimJetonuAl();
  if (jeton === null) return;
  await api.bildirimJetonuSil(oturumJetonu, jeton);
}
