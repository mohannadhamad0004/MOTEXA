// Full backend suite with a process-only test secret; never edits .env or logs secret values.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
const result=spawnSync(process.execPath,['--import','./scripts/register-typescript.mjs','--test','--test-concurrency=1','tests/*.test.ts','tests/*.test.mjs'],{
 cwd:new URL('../',import.meta.url),env:{...process.env,OTP_HASH_SECRET:randomBytes(32).toString('hex')},stdio:'inherit',windowsHide:true,
});
process.exitCode=result.status??1;
