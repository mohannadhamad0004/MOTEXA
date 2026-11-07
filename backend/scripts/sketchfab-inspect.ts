// Read-only candidate inspection. No download endpoint, archive request, queue or publication.
import "dotenv/config";
import {createSketchfabClient} from "../src/services/sketchfab-client.js";
import {existingSketchfab} from "../src/services/vehicle3d-import-state.js";
import {prisma} from "../src/prisma.js";
try {
 const inspection=await createSketchfabClient().inspect(process.argv[2]);
 const duplicate=await prisma.$transaction(tx=>existingSketchfab(tx,inspection.uid));
 console.log(JSON.stringify({inspection,duplicate,downloaded:false},null,2));
}catch(e){console.log(JSON.stringify({code:(e as any)?.code??"SKETCHFAB_API_FAILED",message:"Candidate inspection could not complete. No download attempted."}));process.exitCode=1;}
finally{await prisma.$disconnect();}
