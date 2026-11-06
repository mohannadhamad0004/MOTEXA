// Optimise a ready-made accessory model for the app (it may be drawn several times, e.g. a rim x4): drop named materials' meshes
// (a tyre, a logo decal), prune / dedup / weld, WebP textures at most --tex px, meshopt-compressed GLB. Reports the size.
//   node scripts/optimize-accessory.mjs --in=<glb> --out=<glb> [--drop=Tire,D2Logo] [--plain=Textures] [--tex=512]
// --plain: those materials lose their textures (a brand logo on a centre cap) and become a plain neutral metal (same shape).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { statSync } from 'node:fs';

const arg = n => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(arg('in')), drop = (arg('drop') ?? '').split(',').filter(Boolean), plain = (arg('plain') ?? '').split(',').filter(Boolean), tex = Number(arg('tex') ?? 512);
for (const m of doc.getRoot().listMaterials()) if (plain.includes(m.getName()))
  m.setBaseColorTexture(null).setMetallicRoughnessTexture(null).setNormalTexture(null).setEmissiveTexture(null).setBaseColorFactor([0.56, 0.57, 0.59, 1]).setMetallicFactor(0.85).setRoughnessFactor(0.35);
for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives())
  if (drop.includes(prim.getMaterial()?.getName() ?? '')) { prim.dispose(); }
for (const node of doc.getRoot().listNodes()) { const m = node.getMesh(); if (m && !m.listPrimitives().length) { node.setMesh(null); m.dispose(); } }
await doc.transform(prune(), dedup(), weld(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex] }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
doc.createExtension(EXTMeshoptCompression).setRequired(true);
await io.write(arg('out'), doc);
const tris = doc.getRoot().listMeshes().flatMap(m => m.listPrimitives()).reduce((a, p) => a + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0);
console.log(JSON.stringify({ out: arg('out'), bytes: statSync(arg('out')).size, triangles: tris, materials: doc.getRoot().listMaterials().map(m => m.getName()) }));
