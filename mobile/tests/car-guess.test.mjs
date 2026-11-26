// "Add 3D model": brand / model / generation read from a Sketchfab title and tags.
import assert from "node:assert/strict";
import { test } from "node:test";
import { guessCar } from "../src/features/vehicleCatalog/carGuess.ts";

const tax = {
  brands: [{ id: "b-merc", name: "Mercedes", aliases: ["Mercedes-Benz", "Benz"] }, { id: "b-bmw", name: "BMW", aliases: [] }, { id: "b-vw", name: "Volkswagen", aliases: ["VW"] }],
  vehicles: [
    { id: "v-c", brandId: "b-merc", model: "C-Class", generations: [{ id: "g-202", code: "202", yearFrom: 1993, yearTo: 2000 }, { id: "g-w203", code: "W203", yearFrom: 2000, yearTo: 2007 }] },
    { id: "v-e", brandId: "b-merc", model: "E-Class", generations: [{ id: "g-w212", code: "W212", yearFrom: 2009, yearTo: 2016 }] },
    { id: "v-3", brandId: "b-bmw", model: "3 Series", generations: [{ id: "g-e36", code: "E36", yearFrom: 1990, yearTo: 2000 }, { id: "g-e46", code: "E46", yearFrom: 1998, yearTo: 2006 }] },
    { id: "v-golf", brandId: "b-vw", model: "Golf", generations: [{ id: "g-mk4", code: "Mk4", yearFrom: 1997, yearTo: 2006 }] },
  ],
};

test("brand, model and generation come from the title and tags", () => {
  const w202 = guessCar("1997 Mercedes C-class W202", ["mercedes", "w202", "lowpoly"], tax);
  assert.deepEqual([w202.brandId, w202.modelId, w202.generationId, w202.year], ["b-merc", "v-c", "g-202", 1997]);
  // a code beats the year; the year decides only when exactly one generation was built then
  assert.equal(guessCar("BMW 3 Series E46 coupe 1999", [], tax).generationId, "g-e46");
  assert.equal(guessCar("BMW 3 Series 1999", [], tax).generationId, null, "1999 fits E36 and E46: the admin picks");
  // aliases and tags count; short codes never match by accident
  const vw = guessCar("Hatchback", ["vw", "golf", "2001"], tax);
  assert.deepEqual([vw.brandId, vw.modelId, vw.generationId], ["b-vw", "v-golf", "g-mk4"]);
  assert.deepEqual(guessCar("Generic sports car", ["car"], tax), { brandId: null, modelId: null, generationId: null, make: null, model: null, year: null });
});
