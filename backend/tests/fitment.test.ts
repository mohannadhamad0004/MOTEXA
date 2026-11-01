import { test } from "node:test";
import assert from "node:assert/strict";
import { fitStatus, fitWhere } from "../src/services/fitment.js";

const corolla = { make: "Toyota", model: "Corolla", yearFrom: 2014, yearTo: 2019 };
const shared = { isUniversal: false, fitments: [corolla, { make: "Hyundai", model: "Elantra", yearFrom: 2016, yearTo: 2020 }, { make: "Kia", model: "Cerato", yearFrom: 2014, yearTo: 2018 }] };

test("a fitment row matches make + model inside the year range (edges included)", () => {
  assert.equal(fitStatus(shared, { make: "toyota", model: " corolla ", year: 2014 }), "FITS");
  assert.equal(fitStatus(shared, { make: "Toyota", model: "Corolla", year: 2019 }), "FITS");
  assert.equal(fitStatus(shared, { make: "Hyundai", model: "Elantra", year: 2018 }), "FITS");
});
test("outside the year range, another model or make: not a fit", () => {
  assert.equal(fitStatus(shared, { make: "Toyota", model: "Corolla", year: 2013 }), "NOT_LISTED");
  assert.equal(fitStatus(shared, { make: "Toyota", model: "Corolla", year: 2020 }), "NOT_LISTED");
  assert.equal(fitStatus(shared, { make: "Toyota", model: "Yaris", year: 2016 }), "NOT_LISTED");
  assert.equal(fitStatus(shared, { make: "Opel", model: "Corolla", year: 2016 }), "NOT_LISTED");
});
test("universal fits every car; a listed fit still says FITS", () => {
  assert.equal(fitStatus({ isUniversal: true, fitments: [] }, { make: "BMW", model: "X5", year: 2022 }), "UNIVERSAL");
  assert.equal(fitStatus({ isUniversal: true, fitments: [corolla] }, { make: "Toyota", model: "Corolla", year: 2016 }), "FITS");
});
test("no fitment data and not universal: unknown, never a fit", () => {
  assert.equal(fitStatus({ isUniversal: false, fitments: [] }, { make: "Toyota", model: "Corolla", year: 2016 }), "UNKNOWN");
});
test("the catalog filter is fitment row OR universal, with the year as a range check", () => {
  assert.deepEqual(fitWhere({ make: " Toyota ", model: "Corolla", year: 2016 }), {
    OR: [{ isUniversal: true }, { fitments: { some: { makeNormalized: "toyota", modelNormalized: "corolla", yearFrom: { lte: 2016 }, yearTo: { gte: 2016 } } } }],
  });
  assert.deepEqual(fitWhere({ make: "Kia" }), { OR: [{ isUniversal: true }, { fitments: { some: { makeNormalized: "kia" } } }] });
});
