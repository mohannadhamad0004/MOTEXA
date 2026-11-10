// The /dept screens take their colours from the garage tokens: text on the bronze fill (selected chips, active tabs) must stay readable.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

// garage.ts imports React Native modules, so read the two colour tables as text.
const src = readFileSync("src/theme/garage.ts", "utf8");
const table = (name) => Object.fromEntries([...src.slice(src.indexOf(name)).split("};")[0].matchAll(/(\w+): "(#[0-9A-Fa-f]{6})"/g)].map((m) => [m[1], m[2]]));
const garageLight = table("export const garageLight"), garageDark = table("export const garageDark");

const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

for (const [name, g] of [["light", garageLight], ["dark", garageDark]]) {
  test(`${name}: text on the bronze fill and body text meet 4.5:1`, () => {
    assert.ok(ratio(g.accent, g.onAccent) >= 4.5, "fill / fillInk");
    assert.ok(ratio(g.card, g.ink) >= 4.5, "surface / ink");
    assert.ok(ratio(g.cardSoft, g.soft) >= 4.5, "paper / muted");
  });
}
