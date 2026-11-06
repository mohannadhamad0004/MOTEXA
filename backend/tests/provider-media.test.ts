import {test,after} from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {isMp4,normalizeMedia,MEDIA_LIMIT} from "../src/services/provider-media.js";
test("media rejects forged or oversized video and sanitizes images",async()=>{
 assert.equal(isMp4(Buffer.from("ftypisom vide avc1 mdat")),false);
 assert.equal(isMp4(Buffer.alloc(MEDIA_LIMIT+1)),false);
 await assert.rejects(normalizeMedia(Buffer.from("not a movie").toString("base64"),true));
 await assert.rejects(normalizeMedia("%%%%",false));
 const input=await sharp({create:{width:200,height:100,channels:3,background:"red"}}).withMetadata({orientation:6}).png().toBuffer();const result=await normalizeMedia(input.toString("base64"),false),meta=await sharp(result.buffer).metadata();
 assert.equal(result.mimeType,"image/jpeg");assert.equal(meta.orientation,undefined);assert.equal(meta.exif,undefined);assert.equal(meta.width,100);assert.equal(meta.height,200);
});

// This module imports the shared Prisma client through the media service.
after(async()=>{const {prisma}=await import("../src/prisma.js");await prisma.$disconnect();});
