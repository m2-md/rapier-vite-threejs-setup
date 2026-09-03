import { readFileSync } from "node:fs";

const src = readFileSync(
  "node_modules/@dimforge/rapier3d-compat/rapier.mjs",
  "utf8",
);

// Find longest base64 blob in file — this is the embedded WASM.
const blob = src.match(/[A-Za-z0-9+/=]{5000,}/)?.[0] ?? "";
const bytes = Buffer.from(blob, "base64").byteLength;
const fmt = (n) => n.toLocaleString("en-US");

console.log("rapier.mjs      :", fmt(src.length), "characters");
console.log("base64 blob     :", fmt(blob.length), "characters");
console.log("decoded wasm    :", fmt(bytes), "bytes");
console.log("base64 overhead : %" + ((blob.length / bytes - 1) * 100).toFixed(1));
