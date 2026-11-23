import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {fail} from './mechanic-policy.js';
/** Decode, bound dimensions, orient and strip EXIF/GPS by re-encoding. */
export async function prepareVehiclePhoto(value:unknown){
 if(value===undefined)return undefined;
 if(typeof value!=='string'||value.length>5592408||!value.length||value.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(value))fail(400,'Choose a JPEG, PNG or WebP image up to 4 MB.');
 const input=Buffer.from(value,'base64');if(input.length>4*1024*1024)fail(400,'Choose an image up to 4 MB.');
 try{const image=sharp(input,{limitInputPixels:16000000,animated:false}),metadata=await image.metadata();if(!metadata.format||!['jpeg','png','webp'].includes(metadata.format)||!metadata.width||!metadata.height||metadata.width<128||metadata.height<128||(metadata.pages||1)>1)fail(400,'Choose a clear JPEG, PNG or WebP car photo, at least 128 × 128.');const bytes=await image.rotate().resize({width:1600,height:1200,fit:'inside',withoutEnlargement:true}).flatten({background:'#F6EFE5'}).jpeg({quality:84}).toBuffer();return {bytes,digest:createHash('sha256').update(bytes).digest('hex')};}catch(e){if(e instanceof Error&&e.name==='MechanicError')throw e;fail(400,'The photo could not be read. Choose a valid JPEG, PNG or WebP image.');}
}
