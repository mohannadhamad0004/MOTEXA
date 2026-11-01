// Runnable check for the car-aware search parser: npx tsx src/features/catalog/vehicleMatch.check.ts (from mobile/)
import { matchVehicle } from "./vehicleMatch";

const list = [
  { make: "Toyota", makeAr: "تويوتا", model: "Corolla", modelAr: "كورولا", yearFrom: 1995, yearTo: 2027 },
  { make: "Hyundai", makeAr: "هيونداي", model: "Elantra", modelAr: "النترا", yearFrom: 2000, yearTo: 2027 },
  { make: "Hyundai", makeAr: "هيونداي", model: "i10", modelAr: "آي 10", yearFrom: 2008, yearTo: 2027 },
  { make: "Peugeot", makeAr: "بيجو", model: "2008", modelAr: "2008", yearFrom: 2013, yearTo: 2027 },
  { make: "Peugeot", makeAr: "بيجو", model: "208", modelAr: "208", yearFrom: 2012, yearTo: 2027 },
];
const equal = (a: unknown, b: unknown) => {
  if (a !== b) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
const assert = { equal };
const m = (q: string) => {
  const r = matchVehicle(q, list);
  return r && `${r.v.make} ${r.v.model}|${r.year ?? "-"}|${r.rest}`;
};

assert.equal(m("corolla"), "Toyota Corolla|-|");
assert.equal(m("Corolla 2016"), "Toyota Corolla|2016|");
assert.equal(m("كورولا 2016"), "Toyota Corolla|2016|");
assert.equal(m("كورولا ٢٠١٦"), "Toyota Corolla|2016|");
assert.equal(m("hyundai elantra"), "Hyundai Elantra|-|");
assert.equal(m("elantra 2018"), "Hyundai Elantra|2018|");
assert.equal(m("brake pads corolla"), "Toyota Corolla|-|brake pads");
assert.equal(m("corolla 1980"), "Toyota Corolla|-|1980"); // outside the model's years: not taken as the year
assert.equal(m("peugeot 2008 2016"), "Peugeot 2008|2016|");
assert.equal(m("2008"), null); // a numeric model needs its make
assert.equal(m("hyundai"), null); // a make alone is not a car
assert.equal(m("oil filter"), null);
console.log("vehicleMatch: all checks passed");
