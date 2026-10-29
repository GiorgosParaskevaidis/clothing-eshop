import {spawnSync} from 'node:child_process';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const result=spawnSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{cwd:root,encoding:'utf8',windowsHide:true});
if(result.status!==0)throw new Error('Cannot enumerate source files');
const files=[...new Set(result.stdout.split('\0').filter(Boolean))];
const blocked=[];
const signatures=[
 /\b(?:sk_live|sk_test|rk_live|rk_test)_[A-Za-z0-9]{20,}\b/,
 /\b(?:ghp|gho|ghs|ghu)_[A-Za-z0-9]{30,}\b/,
 /\bgithub_pat_[A-Za-z0-9_]{30,}\b/,
 /\bxsmtpsib-[A-Za-z0-9-]{20,}\b/,
 /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/,
 /password_hash\s*=\s*['"][A-Za-z0-9+/=]{60,}['"]/i,
];
for(const file of files){
 if(/(^|\/)\.local\/|(^|\/)appsettings(?:\.[^/]+)?\.Local\.json$|(^|\/)\.env(?!\.example$)|\.(?:pfx|p12|key)$/i.test(file)){blocked.push(file);continue;}
 if(!/\.(?:cs|json|sql|mjs|js|ts|tsx|md|ya?ml|ps1|env|txt|config|xml)$/i.test(file))continue;
 const target=path.join(root,file);
 try{
  if((await stat(target)).size>2*1024*1024)continue;
  const source=await readFile(target,'utf8');
  if(signatures.some(pattern=>pattern.test(source)))blocked.push(file);
 }catch(error){if(error.code!=='ENOENT')throw error;}
}
if(blocked.length){for(const file of blocked)console.error('Review private data in source path: '+file);process.exitCode=1;}
else console.log('Source secret checks passed for '+files.length+' non-ignored paths. Private local files were excluded.');
