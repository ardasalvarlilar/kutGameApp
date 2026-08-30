// Monorepo icin Metro ayari.
//
// Expo'nun kendi varsayilani bu depoyu zaten dogru cozuyor: packages/engine'i
// izliyor, hem paket hem depo kokundeki node_modules'u goruyor. Elle
// `watchFolders`i depo koku yapmak butun node_modules'u taratip soguk
// baslangici dakikalara cikariyordu — o yuzden varsayilana birakildi.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
