// Local Node 24 fallback when tsx cannot initialize Windows userInfo in the sandbox.
import { registerHooks, createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ts = require('typescript');
registerHooks({
  resolve(specifier, context, next) {
    try { return next(specifier, context); }
    catch (error) {
      if (specifier.endsWith('.js') && specifier.startsWith('.') && context.parentURL) {
        const url = new URL(specifier.slice(0, -3) + '.ts', context.parentURL);
        if (existsSync(url)) return { url: url.href, shortCircuit: true };
      }
      throw error;
    }
  },
  load(url, context, next) {
    if (url.endsWith('.ts')) return { format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      }).outputText };
    return next(url, context);
  },
});
