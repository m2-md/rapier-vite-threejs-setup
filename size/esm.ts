// ÖLÇÜM GİRİŞİ — three.js yok, sahne yok, HUD yok.
// Makaledeki bayt tablosu bilerek "boş bir uygulama dosyası" ile ölçülür:
// böylece iki kurulum arasındaki fark yalnızca Rapier'ın teslim biçiminden gelir.
import RAPIER from "@dimforge/rapier3d";

const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
console.log(RAPIER.version(), world.timestep);
