// Manual, read-only diagnosis of the real development configuration. Never creates a provider task or import.
import {prisma} from "../src/prisma.js";
import {createMeshyClient,MESHY_GENERATION_CREDITS} from "../src/services/meshy-client.js";
import {createSketchfabClient,parseSketchfabUrl} from "../src/services/sketchfab-client.js";
import {readManifest} from "../src/services/vehicle3d-catalog.js";
const output:Record<string,unknown>={manual:true,mocked:false,expectedMeshyCredits:MESHY_GENERATION_CREDITS,creditsSpent:0};
try{
 try{output.requests=await prisma.productAccessory3D.findMany({where:{accessoryType:"REAR_BUMPER"},select:{id:true,status:true,generationMode:true,provider:true,providerTaskId:true,creditsUsed:true,approvedAt:true,product:{select:{name:true}},_count:{select:{photos:true}}},orderBy:{updatedAt:"desc"},take:5});}catch(e){output.databaseError=(e as {code?:string}).code??"DATABASE_UNAVAILABLE";}
 try{const r=await fetch("http://127.0.0.1:5000/api/health",{signal:AbortSignal.timeout(3000)});output.backendHttpStatus=r.status;await r.body?.cancel();}catch(e){output.backendError=(e as {cause?:{code?:string}}).cause?.code??"NETWORK_ERROR";}
 try{output.meshyCredits=await createMeshyClient({key:process.env.MESHY_API_KEY,maxBytes:8*1024*1024}).balance();}catch(e){output.meshyError=(e as {code?:string}).code??"NETWORK_ERROR";}
 const source=process.argv[2]??Object.values(readManifest()).find(e=>/mercedes/i.test(e.make)&&e.url.startsWith("https://sketchfab.com/3d-models/"))!.url;
 output.sketchfabUrl=source;output.sketchfabUid=parseSketchfabUrl(source).uid;
 try{output.inspection=await createSketchfabClient().inspect(source);}catch(e){output.sketchfabError=(e as {code?:string}).code??"NETWORK_ERROR";}
 console.log(JSON.stringify(output,null,2));
 if(output.databaseError||output.backendError||output.meshyError||output.sketchfabError)process.exitCode=1;
}finally{await prisma.$disconnect();}
