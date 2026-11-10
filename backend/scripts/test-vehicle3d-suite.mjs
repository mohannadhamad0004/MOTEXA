// Full backend suite with a process-only test secret; never edits .env or logs secret values.
import 'dotenv/config';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import {createWriteStream,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
const schema='motexa_test3d_'+randomBytes(8).toString('hex');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const quote=s=>'"'+s.replaceAll('"','""')+'"';
let created=false;
try{
 await pool.query(`CREATE SCHEMA ${quote(schema)}`);created=true;
 const client=await pool.connect();try{
  await client.query(`SET search_path TO ${quote(schema)},public`);
  const localize=s=>s.replaceAll('public.',quote(schema)+'.');
  const {rows:enums}=await client.query("SELECT t.typname,array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid WHERE n.nspname='public' GROUP BY t.typname");
  for(const e of enums)await client.query(`CREATE TYPE ${quote(schema)}.${quote(e.typname)} AS ENUM (${e.labels.map(x=>"'"+x.replaceAll("'","''")+"'").join(',')})`);
  const {rows:tables}=await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'");
  for(const {tablename}of tables){
   await client.query(`CREATE TABLE ${quote(schema)}.${quote(tablename)} (LIKE public.${quote(tablename)} INCLUDING ALL EXCLUDING CONSTRAINTS EXCLUDING INDEXES)`);
   const {rows:cols}=await client.query("SELECT a.attname,t.typtype,t.typname,pg_get_expr(d.adbin,d.adrelid) AS default_expr FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_type t ON t.oid=a.atttypid LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relname=$1 AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum",[tablename]);
   for(const c of cols.filter(c=>c.typtype==='e')){
    await client.query(`ALTER TABLE ${quote(schema)}.${quote(tablename)} ALTER COLUMN ${quote(c.attname)} DROP DEFAULT`);
    await client.query(`ALTER TABLE ${quote(schema)}.${quote(tablename)} ALTER COLUMN ${quote(c.attname)} TYPE ${quote(schema)}.${quote(c.typname)} USING ${quote(c.attname)}::text::${quote(schema)}.${quote(c.typname)}`);
    if(c.default_expr)await client.query(`ALTER TABLE ${quote(schema)}.${quote(tablename)} ALTER COLUMN ${quote(c.attname)} SET DEFAULT ${localize(c.default_expr)}`);
   }
   const selected=cols.map(c=>quote(c.attname)+(c.typtype==='e'?`::text::${quote(schema)}.${quote(c.typname)}`:'')).join(',');
   await client.query(`INSERT INTO ${quote(schema)}.${quote(tablename)} SELECT ${selected} FROM public.${quote(tablename)}`);
  }
  const {rows:keys}=await client.query("SELECT t.relname AS tablename,c.conname,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.contype IN ('p','u') AND n.nspname='public' AND t.relname <> '_prisma_migrations'");
  for(const c of keys)await client.query(`ALTER TABLE ${quote(schema)}.${quote(c.tablename)} ADD CONSTRAINT ${quote(c.conname)} ${localize(c.definition)}`);
  const {rows:indexes}=await client.query("SELECT pg_get_indexdef(i.indexrelid) AS definition FROM pg_index i JOIN pg_class t ON t.oid=i.indrelid JOIN pg_namespace n ON n.oid=t.relnamespace LEFT JOIN pg_constraint c ON c.conindid=i.indexrelid WHERE n.nspname='public' AND c.oid IS NULL AND t.relname <> '_prisma_migrations'");
  for(const i of indexes)await client.query(localize(i.definition));
  const {rows:constraints}=await client.query("SELECT t.relname AS tablename,c.conname,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE c.contype IN ('f','c') AND n.nspname='public'");
  for(const c of constraints)await client.query(`ALTER TABLE ${quote(schema)}.${quote(c.tablename)} ADD CONSTRAINT ${quote(c.conname)} ${localize(c.definition)}`);
 }finally{client.release();}
 console.log('Isolated backend test schema ready. Paid provider network requests are blocked.');
 const logDir=resolve('../.private/3d-lifecycle/checks');mkdirSync(logDir,{recursive:true});const logFile=resolve(logDir,Date.now()+'-backend.log');const log=createWriteStream(logFile);console.log('Test log: '+logFile);
 const files=process.argv.slice(2);const code=await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['--import','./scripts/register-typescript.mjs','--import','./scripts/test-no-paid-provider.mjs','--test','--test-concurrency=1',...(files.length?files:['tests/*.test.ts','tests/*.test.mjs'])],{
   cwd:new URL('../',import.meta.url),env:{...process.env,NODE_ENV:'test',MOTEXA_TEST_SCHEMA:schema,OTP_HASH_SECRET:randomBytes(32).toString('hex'),VEHICLE3D_MODE:'mock',MESHY_ALLOW_PAID_GENERATION:'0',MESHY_API_KEY:''},stdio:['ignore','pipe','pipe'],windowsHide:true});child.stdout.pipe(process.stdout);child.stdout.pipe(log,{end:false});child.stderr.pipe(process.stderr);child.stderr.pipe(log,{end:false});child.on('error',reject);child.on('close',code=>resolve(code??1));
 });log.end();process.exitCode=code;
}catch(e){console.error('Isolated backend checks failed: '+(e.code??e.name));process.exitCode=1;}
finally{if(created&&/^motexa_test3d_[a-f0-9]{16}$/.test(schema))await pool.query(`DROP SCHEMA ${quote(schema)} CASCADE`);await pool.end();}
