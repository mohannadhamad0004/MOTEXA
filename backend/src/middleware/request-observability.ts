import {randomUUID} from 'node:crypto';
import type {Request,Response,NextFunction,RequestHandler,ErrorRequestHandler} from 'express';

type LogRecord={event:string;requestId:string;method:string;path:string;status:number;durationMs?:number;errorType?:string};
type LogSink=(entry:LogRecord)=>void;
const write:LogSink=entry=>console.info(JSON.stringify({timestamp:new Date().toISOString(),...entry}));
/** Correlate HTTP results without logging authorization headers, query strings or bodies. */
export function requestContext(sink:LogSink=write):RequestHandler{return (req:Request,res:Response,next:NextFunction)=>{
 const requestId=randomUUID(),start=process.hrtime.bigint();res.locals.requestId=requestId;res.setHeader('X-Request-ID',requestId);
 const record=(event:string,status:number)=>sink({event,requestId,method:req.method,path:req.path.slice(0,200),status,durationMs:Math.round(Number(process.hrtime.bigint()-start)/1e5)/10});
 res.once('finish',()=>record('http_request',res.statusCode));res.once('close',()=>{if(!res.writableFinished)record('http_request_aborted',499);});next();
};}
/** Central fallback. Expected business errors remain with their route's existing handler. */
export function unexpectedErrorHandler(sink:LogSink=write):ErrorRequestHandler{return (error:unknown,req:Request,res:Response,next:NextFunction)=>{
 if(res.headersSent){next(error);return;}
 const requested=(error as {status?:unknown}|null)?.status,status=requested===400?400:requested===413?413:500;
 const requestId=typeof res.locals.requestId==='string'?res.locals.requestId:randomUUID();
 sink({event:'http_error',requestId,method:req.method,path:req.path.slice(0,200),status,errorType:error instanceof Error?error.name:'UnknownError'});
 res.status(status).json({success:false,requestId,message:status===413?'Request body is too large.':status===400?'Invalid request body.':'An unexpected server error occurred.'});
};}
