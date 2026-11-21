import {inflateRawSync, crc32} from "node:zlib";
import path from "node:path";
import {NodeIO, type JSONDocument} from "@gltf-transform/core";
import {ALL_EXTENSIONS} from "@gltf-transform/extensions";
import {MeshoptDecoder} from "meshoptimizer";
import {MAX_SOURCE_BYTES} from "./sketchfab-client.js";
import {fail, readSafeGLB} from "./vehicle3d-validation.js";

const invalid = (): never => fail("ARCHIVE_INVALID", "The model archive is invalid or exceeds safe extraction limits.",422);
const sourceLimits={maxBytes:MAX_SOURCE_BYTES,textureSize:8192,pixels:128_000_000};
/** ZIP reader over bounded buffers, using Node's bounded inflater. No archive entry is written to disk.
 * Only stored/deflate, single-volume, non-encrypted, non-ZIP64 regular files are admitted. */
export function readModelArchive(bytes: Buffer): Map<string, Buffer> {
  try {
    if(bytes.length<22 || bytes.length>MAX_SOURCE_BYTES)return invalid();
    let end=-1;
    for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes.readUInt32LE(i)===0x06054b50 && i+22+bytes.readUInt16LE(i+20)===bytes.length){end=i;break;}
    if(end<0 || bytes.readUInt16LE(end+4) || bytes.readUInt16LE(end+6))return invalid();
    const count=bytes.readUInt16LE(end+10),size=bytes.readUInt32LE(end+12),offset=bytes.readUInt32LE(end+16);
    if(count!==bytes.readUInt16LE(end+8)||count>2048||offset+size!==end)return invalid();
    const files=new Map<string,Buffer>(),seen=new Set<string>(),ranges:[number,number][]=[];let at=offset,total=0;
    for(let i=0;i<count;i++){
      if(at+46>end || bytes.readUInt32LE(at)!==0x02014b50)return invalid();
      const flags=bytes.readUInt16LE(at+8),method=bytes.readUInt16LE(at+10),crc=bytes.readUInt32LE(at+16),packed=bytes.readUInt32LE(at+20),unpacked=bytes.readUInt32LE(at+24);
      const nl=bytes.readUInt16LE(at+28),extra=bytes.readUInt16LE(at+30),comment=bytes.readUInt16LE(at+32),local=bytes.readUInt32LE(at+42),mode=bytes.readUInt32LE(at+38)>>>16;
      if(flags&~0x080e || flags&1 || ![0,8].includes(method) || [packed,unpacked,local].includes(0xffffffff) || at+46+nl+extra+comment>end || bytes.readUInt16LE(at+34))return invalid();
      const name=bytes.toString("utf8",at+46,at+46+nl);
      if(!name||name.length>500||/[\\:\x00-\x1f\x7f]/.test(name)||name.startsWith("/")||name.split("/").some(p=>p==="."||p==="..")||mode&&![0,0x4000,0x8000].includes(mode&0xf000))return invalid();
      const normalized=name.toLowerCase();if(seen.has(normalized))return invalid();seen.add(normalized);
      if(local+30>offset||bytes.readUInt32LE(local)!==0x04034b50||bytes.readUInt16LE(local+6)!==flags||bytes.readUInt16LE(local+8)!==method)return invalid();
      const lnl=bytes.readUInt16LE(local+26),lextra=bytes.readUInt16LE(local+28),start=local+30+lnl+lextra,stop=start+packed;
      if(stop>offset||bytes.toString("utf8",local+30,local+30+lnl)!==name||ranges.some(([a,b])=>local<b&&stop>a))return invalid();ranges.push([local,stop]);
      if(!(flags&8)&&(bytes.readUInt32LE(local+14)!==crc||bytes.readUInt32LE(local+18)!==packed||bytes.readUInt32LE(local+22)!==unpacked))return invalid();
      total+=unpacked;
      if(unpacked>64*1024*1024||total>MAX_SOURCE_BYTES||unpacked>Math.max(1024*1024,packed*300))return invalid();
      if(!name.endsWith("/")){
        const data=method===0?Buffer.from(bytes.subarray(start,stop)):inflateRawSync(bytes.subarray(start,stop),{maxOutputLength:Math.max(1,unpacked)});
        if(data.length!==unpacked||crc32(data)!==crc)return invalid();files.set(name,data);
      } else if(packed||unpacked)return invalid();
      at+=46+nl+extra+comment;
    }
    if(at!==end)return invalid();return files;
  }catch{return invalid();}
}
/** Convert only local resources supplied in this one archive. NodeIO receives no filesystem/network URI. */
export async function convertSketchfabAsset(bytes: Buffer): Promise<Buffer> {
  if(bytes.subarray(0,4).toString()==="glTF") {await readSafeGLB(bytes,2_000_000,sourceLimits);return bytes;}
  const files=readModelArchive(bytes);
  const models=[...files.keys()].filter(k=>/\.(gltf|glb)$/i.test(k));
  const preferred=models.find(k=>/(^|\/)scene\.gltf$/i.test(k));
  const name=preferred??(models.length===1?models[0]:undefined);
  if(!name)return fail("CONVERSION_FAILED","The archive has no unambiguous supported GLB or glTF model.",422);
  const main=files.get(name)!;
  if(/\.glb$/i.test(name)){await readSafeGLB(main,2_000_000,sourceLimits);return main;}
  try {
    if(main.length>8*1024*1024)throw new Error();
    const data=JSON.parse(main.toString("utf8")),resources:Record<string,Uint8Array>=Object.create(null);
    if(data.asset?.version!=="2.0" || data.animations?.length || data.skins?.length)throw new Error();
    for(const resource of [...(data.buffers??[]),...(data.images??[])]){
      if(resource.uri===undefined)continue;
      if(typeof resource.uri!=="string"||resource.uri.length>1000)throw new Error();
      const uri=decodeURIComponent(resource.uri);
      if(/[\\:\x00-\x1f\x7f?#]/.test(uri)||uri.startsWith("/")||uri.split("/").some(p=>p===".."||p==="."))throw new Error();
      const file=files.get(path.posix.join(path.posix.dirname(name),uri));if(!file)throw new Error();
      resources[resource.uri]=file;
    }
    await MeshoptDecoder.ready;
    const io=new NodeIO().setAllowNetwork(false).registerExtensions(ALL_EXTENSIONS).registerDependencies({"meshopt.decoder":MeshoptDecoder});
    const doc=await io.readJSON({json:data,resources} as JSONDocument);
    const buffers=doc.getRoot().listBuffers();if(!buffers.length)throw new Error();
    for(const accessor of doc.getRoot().listAccessors())accessor.setBuffer(buffers[0]!);
    for(const buffer of buffers.slice(1))buffer.dispose();
    const result=Buffer.from(await io.writeBinary(doc));await readSafeGLB(result,2_000_000,sourceLimits);return result;
  }catch{return fail("CONVERSION_FAILED","The glTF model could not be converted safely.",422);}
}
