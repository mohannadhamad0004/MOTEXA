import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOG_GROUPS, PRODUCT_CATEGORY_KEYS, SUBCATEGORIES, categoriesOfGroup, categoryFamily, isAnyCategory, isProductCategory } from "../src/catalogCategories.js";

test("a category filter covers itself + its sub-categories; a sub-category only itself", () => {
  assert.deepEqual(categoryFamily("LIGHTING"), ["LIGHTING", "HEADLIGHTS", "BULBS", "FOG_LIGHTS", "TAIL_LIGHTS"]);
  assert.deepEqual(categoryFamily("BULBS"), ["BULBS"]);
  assert.deepEqual(categoryFamily("TIRES"), ["TIRES"]);
});
test("a product stores a leaf only: never a category that has sub-categories", () => {
  assert.equal(isProductCategory("BULBS"), true);
  assert.equal(isProductCategory("TIRES"), true);
  assert.equal(isProductCategory("LIGHTING"), false);
  assert.equal(isProductCategory("NOPE"), false);
  assert.equal(isAnyCategory("LIGHTING"), true);
  assert.equal(isAnyCategory("HEADLIGHTS"), true);
});
test("every leaf belongs to exactly one category and one group (no key in two places)", () => {
  const owners = new Map<string, number>();
  for (const g of CATALOG_GROUPS) for (const k of categoriesOfGroup(g.key)) owners.set(k, (owners.get(k) ?? 0) + 1);
  for (const k of PRODUCT_CATEGORY_KEYS) assert.equal(owners.get(k), 1, k);
  const subs = Object.values(SUBCATEGORIES).flat();
  assert.equal(new Set(subs).size, subs.length);
});
