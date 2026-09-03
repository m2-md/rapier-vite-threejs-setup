import { readFileSync } from "node:fs";

const src = readFileSync(
  "node_modules/@dimforge/rapier3d-compat/rapier.mjs",
  "utf8",
);

// Dosyadaki en uzun base64 bloğunu bul — gömülü WASM bu.
const blob = src.match(/[A-Za-z0-9+/=]{5000,}/)?.[0] ?? "";
const bytes = Buffer.from(blob, "base64").byteLength;
const fmt = (n) => n.toLocaleString("tr-TR");

console.log("rapier.mjs      :", fmt(src.length), "karakter");
console.log("base64 blok     :", fmt(blob.length), "karakter");
console.log("çözülmüş wasm   :", fmt(bytes), "bayt");
console.log("base64 vergisi  : %" + ((blob.length / bytes - 1) * 100).toFixed(1));
