// Every plain-words key is the start of a message the backend can really save (validation, import service, viewer check script).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { IMPORT_FAILURE_TEXT, failureText, simplifiedText, trianglesShort } from "../src/features/vehicleCatalog/importState.ts";

test("import failure texts match backend messages and read in plain words", () => {
  const backend = ["../backend/src/services/vehicle3d-validation.ts", "../backend/src/services/vehicle3d-imports.ts", "../backend/scripts/vehicle3d-viewer-check.mjs"]
    .map((f) => readFileSync(f, "utf8")).join("\n");
  for (const start of Object.keys(IMPORT_FAILURE_TEXT)) assert.ok(backend.includes(start), `backend no longer says: ${start}`);
  const t = (en, ar) => ({ en, ar });
  const w202 = failureText({ stage: "VALIDATING", message: "Model needs nonzero geometry and at most 500,000 triangles.", triangles: 1186481, limit: 500000 }, t);
  assert.match(w202.en, /^Even after simplifying for phones this model has 1,186,481 triangles; the limit is 500,000\./);
  assert.match(w202.ar, /١٬١٨٦٬٤٨١/);
  assert.deepEqual(failureText({ stage: "VALIDATING", message: "Something new." }, t), { en: "Something new.", ar: "تعذّر إكمال الاستيراد. التفاصيل التقنية: Something new." });
  assert.equal(failureText({ stage: "CONVERTING", message: null }, t), null);
  assert.equal(failureText(null, t), null);
  assert.deepEqual(simplifiedText({ before: 1186481, after: 286967 }, t), { en: "Simplified for phones: 1.2M → 287k triangles", ar: "بُسّط للهواتف: من ١٫٢ مليون إلى ٢٨٧ ألف مثلث" });
  assert.deepEqual(trianglesShort(2000000), ["2M", "٢ مليون"]);
});
