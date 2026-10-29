import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const result=spawnSync('dotnet',['list','backend/Thesamenot.Api','package','--vulnerable','--include-transitive','--format','json','--no-restore'],{cwd:root,encoding:'utf8',windowsHide:true});
if(result.status!==0){console.error('NuGet vulnerability check failed to run.');process.exit(1);}
let report;
try{report=JSON.parse(result.stdout);}catch{console.error('NuGet vulnerability report could not be parsed.');process.exit(1);}
const vulnerable=(report.projects??[]).flatMap(project=>(project.frameworks??[]).flatMap(framework=>[...(framework.topLevelPackages??[]),...(framework.transitivePackages??[])])).filter(pkg=>pkg.vulnerabilities?.length);
if(vulnerable.length){console.error('Vulnerable NuGet packages require review: '+vulnerable.map(pkg=>pkg.id).join(', '));process.exitCode=1;}
else console.log('NuGet vulnerability audit passed, including transitive dependencies.');
