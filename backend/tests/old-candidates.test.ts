import { test } from "node:test";
import assert from "node:assert/strict";
import { historyWithoutFiles, oldCandidateFiles } from "../src/services/accessory3d.js";

test("on publish every earlier candidate's files go, the current model's files stay, task ids stay in history", () => {
  const a = {
    rawModelPath: "cur.glb", privateModelPath: "cur.glb", preview: { views: { front: "cur-front.png" } },
    generationHistory: [
      { revision: 1, provider: "MESHY", taskId: "task-1", raw: "old-raw.glb", prepared: "old.glb", preview: { views: { front: "old-front.png", rear: "cur-front.png" } } },
      { reason: "LOCAL_PROCESSING_RETRY", taskId: "task-1", prepared: "old.glb" },
      { revision: 2, discarded: true, taskId: "task-2" },
    ],
  };
  assert.deepEqual(oldCandidateFiles(a).sort(), ["old-front.png", "old-raw.glb", "old.glb"]);
  assert.deepEqual(historyWithoutFiles(a.generationHistory), [{ revision: 1, provider: "MESHY", taskId: "task-1" }, { reason: "LOCAL_PROCESSING_RETRY", taskId: "task-1" }, { revision: 2, discarded: true, taskId: "task-2" }]);
  assert.deepEqual(oldCandidateFiles({ rawModelPath: null, privateModelPath: null, preview: null, generationHistory: null }), []);
});
