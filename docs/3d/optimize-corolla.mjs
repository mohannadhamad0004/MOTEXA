// Corolla: drop the interior, webp textures (max 1024), meshopt geometry. node optimize.mjs <in> <out>
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, textureCompress, weld } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";
import sharp from "sharp";
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
const doc = await io.read(process.argv[2]);
const DROP = /^corolla_e180_(interior1|interior_front|furniture|dashboard(\.\d+)?|steering_wheel)$/;
const removed = [];
for (const n of doc.getRoot().listNodes()) if (DROP.test(n.getName())) { removed.push(n.getName()); n.listChildren().forEach((c) => c.dispose()); n.dispose(); }
console.log("removed nodes:", removed.join(", "));
await doc.transform(
  prune(),
  dedup(),
  weld(),
  textureCompress({ encoder: sharp, targetFormat: "webp", resize: [1024, 1024], quality: 82 }),
  meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  prune(),
);
await io.write(process.argv[3], doc);
