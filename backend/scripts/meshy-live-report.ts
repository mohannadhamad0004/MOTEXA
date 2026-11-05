// Read-only report after a human intentionally starts ONE live generation. Never creates/polls a Meshy job.
import {prisma} from "../src/prisma.js";
import {existsSync,statSync} from "node:fs";
import {privatePath} from "../src/services/vehicle3d-submissions.js";
const id=process.argv.find(a=>a.startsWith("--submission-id="))?.slice(16);
try{
  if(!id)throw Error();
  const s=await prisma.vehicle3DSubmission.findUnique({where:{id}});if(!s)throw Error();
  const events=await prisma.auditLog.findMany({where:{targetId:id,action:{startsWith:"VEHICLE3D_"}},orderBy:{createdAt:"asc"},select:{action:true,createdAt:true}});
  const validation=s.validation as Record<string,unknown>|null;
  console.log(JSON.stringify({provider:s.provider,task:s.providerTaskId?`${s.providerTaskId.slice(0,4)}…${s.providerTaskId.slice(-4)}`:null,
    status:s.status,stage:s.generationStage,providerState:s.providerState,progress:s.providerProgress,
    durationSeconds:s.processingStartedAt?Math.round(((s.providerFinishedAt??new Date()).getTime()-s.processingStartedAt.getTime())/1000):null,
    preparedBytes:s.privateModelPath&&existsSync(privatePath(s.privateModelPath))?statSync(privatePath(s.privateModelPath)).size:null,
    validation:validation?.valid??false,viewer:validation?.viewer??null,
    promotionEligible:s.provider==="MESHY"&&s.generationMode==="meshy"&&s.providerState==="SUCCEEDED"&&!!s.catalogConsentAt&&validation?.valid===true,
    stillRequires:"Parts Admin visual verification, generation match and replacement checks",sequence:events},null,2));
}catch{console.error("Supply one existing --submission-id=<uuid>. This command is read-only.");process.exitCode=1;}
finally{await prisma.$disconnect();}
