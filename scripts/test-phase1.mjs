import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { openSync, closeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import mysql from '../frontend/node_modules/mysql2/promise.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseline = process.argv.includes('--baseline');
const focusBrowser=process.argv.includes('--focus-browser');
const focusPayments=process.argv.includes('--focus-payments');
const focusManual=process.argv.includes('--focus-manual');
const browser = process.argv.includes('--browser')||focusBrowser;
const reuseFrontendBuild=process.argv.includes('--reuse-frontend-build');
const browserLastFailed=process.argv.includes('--browser-last-failed');
const runId = randomBytes(6).toString('hex');
const database = 'phase1_' + runId + '_test';
const directory = path.join(root, '.local', 'phase1', runId);
const apiPort = 5082;
const webPort = 3001;
const apiUrl = 'http://127.0.0.1:' + apiPort;
const publicUrl = 'http://127.0.0.1:' + webPort;
const password = 'Fixture-9!' + randomBytes(18).toString('hex');
const email = 'admin@phase1.example';
let server, frontend, db, created = false;
const children = [];

function run(command, args, extra = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', windowsHide: true, ...extra });
  if (result.status !== 0) throw new Error(command + ' failed');
}
function nodeCommand(name,args,extra={}) {
  run(process.platform==='win32'?'cmd.exe':name,
    process.platform==='win32'?['/d','/c',name,...args]:args,extra);
}
async function freePort(port) {
  await new Promise((resolve, reject) => {
    const listener = net.createServer();
    listener.once('error', () => reject(new Error('Test port occupied: ' + port + '. No process was stopped.')));
    listener.listen(port, '127.0.0.1', () => listener.close(resolve));
  });
}
async function start(command, args, cwd, env, name) {
  // Tests/builds use spawnSync; pipe draining cannot depend on this parent's event loop.
  const log = openSync(path.join(directory, name + '.log'), 'w');
  let child;
  try { child = spawn(command, args, { cwd, env: { ...process.env, ...env }, windowsHide: true, stdio:['ignore',log,log] }); }
  finally { closeSync(log); }
  children.push(child);
  child.once('error', () => {});
  return child;
}
async function ready(url, child) {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error('Test service stopped; inspect ignored fixture logs.');
    try { if ((await fetch(url, { signal: AbortSignal.timeout(5000) })).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Test service did not become ready.');
}
async function stop(child) {
  if(child.exitCode!==null||child.signalCode!==null) return;
  child.kill();
  await new Promise(resolve=>{child.once('exit',resolve);setTimeout(resolve,5000);});
  if(child.exitCode===null&&child.signalCode===null) throw new Error('Owned test service did not stop.');
}

try {
  await freePort(apiPort); if (browser) await freePort(webPort);
  await mkdir(directory, { recursive: true });
  db = await mysql.createConnection({ host: '127.0.0.1', port: 13307, user: 'root', password: '', multipleStatements: true });
  await db.query('CREATE DATABASE ' + database + ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'); created = true;
  await db.changeUser({ database });
  await db.query(await readFile(path.join(root, 'backend/Thesamenot.Api/Database/schema.sql'), 'utf8'));
  const settings = {
    ConnectionStrings: { Store: 'Server=127.0.0.1;Port=13307;Database=' + database + ';User ID=root;Password=;' },
    Database: { Initialize: false },
    Auth: { Enabled: !baseline, KeyRingPath: path.join(directory, 'keys'), LoginPermitLimit: 1000, AccountPermitLimit: 1000, PublicPermitLimit:10000 },
    Email: { Mode: 'DevelopmentFile', Directory: path.join(directory, 'mail') },
    Store: { PublicUrl: publicUrl, SalesEnabled: true, PaymentMode: 'Simulation', DropOpensAt: '2020-01-01T00:00:00Z' },
    Stripe: { WebhookSecret: 'whsec_local_integration_fixture' },
    BankTransfer: { AccountHolder: 'Fixture only - do not transfer', Iban: 'GB82 WEST 1234 5698 7654 32', Bic: 'WESTGB2L' },
    Cors:{AllowedOrigins:[publicUrl]},
    Merchant:{TaxProfileApproved:true,TaxCalculationMode:'InclusiveSingleRate',TaxRateBasisPoints:2000,TaxPolicyVersion:'fixture-tax-v1'},
    Logging: { LogLevel: { Default: 'Warning' } }
  };
  settings.Media = { LocalDirectory:path.join(directory,'media'), SharpModule:path.join(root,'frontend/node_modules/sharp') };
  const settingsPath = path.join(directory, 'settings.json');
  await writeFile(settingsPath, JSON.stringify(settings));
  run('dotnet',['run','--project','tools/StoreMaintenance','-c','Release','--','verify-tax-contract','--settings',settingsPath]);
  const publish = path.join(directory, 'api');
  run('dotnet', ['publish', 'backend/Thesamenot.Api', '-c', 'Release', '-o', publish, '--nologo']);
  if (baseline) {
    run('dotnet', ['run', '--project', 'tools/StoreMaintenance', '-c', 'Release', '--', 'migrate', '--settings', settingsPath, '--root', root]);
    // Existing setup uses the same Identity PBKDF2 format. Generate a fixture hash without exposing it.
    run('dotnet', ['run', '--project', 'tools/StoreMaintenance', '-c', 'Release', '--', 'fixture-legacy', '--settings', settingsPath], {
      env: { ...process.env, STORE_ADMIN_PASSWORD: password, STORE_ADMIN_EMAIL: email }
    });
  } else {
    await db.query('ALTER TABLE products MODIFY name VARCHAR(119) NOT NULL');
    const mismatched=spawnSync('dotnet',['run','--project','tools/StoreMaintenance','-c','Release','--','migrate','--settings',settingsPath,'--root',root],{cwd:root,encoding:'utf8',windowsHide:true});
    assert.notEqual(mismatched.status,0);assert.match(mismatched.stderr,/operator review/);
    await db.query('ALTER TABLE products MODIFY name VARCHAR(120) NOT NULL');
    console.log('Mismatched commerce baseline refused.');
    await db.query('CREATE TABLE users(id INT PRIMARY KEY) ENGINE=InnoDB');
    await db.query('INSERT INTO users VALUES(42)');
    const collision=spawnSync('dotnet',['run','--project','tools/StoreMaintenance','-c','Release','--no-build','--','migrate','--settings',settingsPath,'--root',root],{cwd:root,encoding:'utf8',windowsHide:true});
    assert.notEqual(collision.status,0);assert.match(collision.stderr,/Existing identity tables/);
    const [preserved]=await db.query('SELECT id FROM users');assert.equal(preserved[0].id,42);
    await db.query('DROP TABLE users');
    console.log('Unrecorded identity-table collision refused without changing its data.');
    run('dotnet', ['run', '--project', 'tools/StoreMaintenance', '-c', 'Release', '--', 'migrate', '--settings', settingsPath, '--root', root]);
    const repeat=spawnSync('dotnet',['run','--project','tools/StoreMaintenance','-c','Release','--no-build','--','migrate','--settings',settingsPath,'--root',root],{cwd:root,encoding:'utf8',windowsHide:true});
    assert.equal(repeat.status,0);assert.match(repeat.stdout,/Applied migrations: 0/);
    const [ledger]=await db.query("SELECT checksum FROM schema_migrations WHERE version='002_identity.sql'");
    for(const change of ["checksum=REPEAT('0',64)","state='failed'"]) {
      await db.query("UPDATE schema_migrations SET "+change+" WHERE version='002_identity.sql'");
      const refused=spawnSync('dotnet',['run','--project','tools/StoreMaintenance','-c','Release','--no-build','--','migrate','--settings',settingsPath,'--root',root],{cwd:root,encoding:'utf8',windowsHide:true});
      assert.notEqual(refused.status,0);assert.match(refused.stderr,/operator review/);
      await db.execute("UPDATE schema_migrations SET checksum=?,state='applied' WHERE version='002_identity.sql'",[ledger[0].checksum]);
    }
    console.log('Migration idempotency, checksum and incomplete-run guards passed.');
    run('dotnet', ['run', '--project', 'tools/StoreMaintenance', '-c', 'Release', '--no-build', '--', 'bootstrap-admin', '--settings', settingsPath], {
      env: { ...process.env, STORE_ADMIN_PASSWORD: password, STORE_ADMIN_EMAIL: email }
    });
    const duplicate=spawnSync('dotnet',['run','--project','tools/StoreMaintenance','-c','Release','--no-build','--','bootstrap-admin','--settings',settingsPath],{cwd:root,encoding:'utf8',windowsHide:true,env:{...process.env,STORE_ADMIN_PASSWORD:password,STORE_ADMIN_EMAIL:email}});
    assert.notEqual(duplicate.status,0);assert.match(duplicate.stderr,/bootstrap refused/);
    console.log('Repeated admin bootstrap refused.');
  }
  // Fixture-only bank details. Runtime configuration cannot override the database settings.
  const [initialPayments]=await db.query('SELECT bank_transfer_enabled,account_holder,iban,bic,version FROM payment_settings WHERE id=1');
  assert.equal(initialPayments[0].bank_transfer_enabled,0);
  assert.equal(initialPayments[0].iban,'');
  await db.execute("UPDATE payment_settings SET bank_transfer_enabled=TRUE,account_holder=?,iban=?,bic=?,version=version+1 WHERE id=1",
    ['Fixture only - do not transfer','GB82WEST12345698765432','WESTGB2L']);
  await writeFile(path.join(publish, 'appsettings.Local.json'), await readFile(settingsPath));
  if(!baseline) {
    const blocklist=path.join(directory,'blocked-passwords.txt');
    await writeFile(blocklist,'F'.repeat(64)+'\n');
    const smtp={Email__Mode:'Smtp',Email__Host:'fixture.invalid',Email__FromAddress:'store@phase1.example',
      Auth__CompromisedPasswordHashesPath:blocklist,Store__PublicUrl:'https://store.phase1.example',Cors__AllowedOrigins__0:'https://store.phase1.example'};
    const cases=[
      [{Auth__Enabled:'false'},/Production requires database identity/],
      [{...smtp,Database__Initialize:'true'},/Production requires database identity/],
      [{},/Accounts require SMTP/],
      [smtp,/Simulation payments are only allowed/],
      [{...smtp,Store__PaymentMode:'Stripe'},/Production requires key encryption at rest/]
    ];
    for(const [overrides,expected] of cases) {
      const rejected=spawnSync('dotnet',[path.join(publish,'Thesamenot.Api.dll')],{
        cwd:publish,encoding:'utf8',windowsHide:true,timeout:15000,
        env:{...process.env,ASPNETCORE_ENVIRONMENT:'Production',ASPNETCORE_URLS:apiUrl,...overrides}
      });
      assert.notEqual(rejected.status,0);assert.match(rejected.stderr,expected);
    }
    console.log('Five unsafe Production startup configurations refused.');
  }
  server = await start('dotnet', [path.join(publish, 'Thesamenot.Api.dll')], publish, {
    ASPNETCORE_ENVIRONMENT: 'Development', ASPNETCORE_URLS: apiUrl,
    ...(focusManual ? {Store__DropOpensAt:'2099-01-01T00:00:00Z'} : {})
  }, 'api');
  await ready(apiUrl + '/api/health', server);
  const testEnv = {
    ...process.env, API_TEST_URL: apiUrl, API_TEST_DB_URL: 'mysql://root@127.0.0.1:13307/' + database,
    API_TEST_ADMIN_EMAIL: email, API_TEST_ADMIN_PASSWORD: password, API_TEST_MAIL_DIR: settings.Email.Directory,
    API_TEST_PUBLIC_URL: publicUrl, API_TEST_AUTH_ENABLED: baseline ? 'false' : 'true',
    API_TEST_AUTH_STATE: path.join(directory,'auth-state.json'),...(focusBrowser||focusManual?{}:{API_TEST_OPERATIONS_STATE:path.join(directory,'operations-state.json')})
  };
  if (!baseline&&!focusPayments) run('node', ['--test', 'frontend/tests-api/auth.test.mjs'], { env: testEnv });
  if (!process.argv.includes('--focus-operations')&&!focusBrowser&&!focusPayments&&!focusManual) {
    run('node', ['--test', 'frontend/tests-api/checkout.test.mjs'], { env: testEnv });
    if (!baseline) run('node', ['--test', 'frontend/tests-api/account.test.mjs'], { env: testEnv });
    if (!baseline) run('node', ['--test', 'frontend/tests-api/catalog.test.mjs'], { env: testEnv });
  }
  if (!baseline&&!focusBrowser&&!focusPayments&&!focusManual) run('node', ['--test', 'frontend/tests-api/operations.test.mjs'], { env: testEnv });
  if (!baseline&&!focusBrowser&&!focusPayments) run('node', ['--test', 'frontend/tests-api/manual-payments.test.mjs'], { env: testEnv });
  if (browser) {
    if(reuseFrontendBuild){
      // Only reuse an explicitly requested build whose proxy targets this isolated API, never the personal store.
      await readFile(path.join(root,'frontend/.next/BUILD_ID'),'utf8');
      const manifest=JSON.parse(await readFile(path.join(root,'frontend/.next/routes-manifest.json'),'utf8'));
      const rewrites=Array.isArray(manifest.rewrites)?manifest.rewrites:Object.values(manifest.rewrites).flat();
      assert.ok(rewrites.some(rule=>rule.source==='/api/:path*'&&rule.destination===apiUrl+'/api/:path*'),
        'The existing frontend build must target the isolated API on 5082.');
      console.log('Reusing verified frontend build targeting the isolated API on 5082.');
    } else nodeCommand('npm', ['run','build'], { cwd: path.join(root, 'frontend'), env: { ...testEnv, API_INTERNAL_URL: apiUrl } });
    frontend = await start('node', ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(webPort)],
      path.join(root, 'frontend'), { API_INTERNAL_URL: apiUrl }, 'frontend');
    await ready(publicUrl + '/api/health', frontend);
    nodeCommand('npx', ['playwright','test',...(browserLastFailed?['--last-failed']:[])], { cwd: path.join(root, 'frontend'), env: {
      ...testEnv, E2E_BASE_URL: publicUrl, E2E_ADMIN_EMAIL: email, E2E_ADMIN_PASSWORD: password
    } });
  }
  if(!baseline&&!focusBrowser&&!focusPayments)
    run('node',['--test','frontend/tests-api/payment-settings.test.mjs'],{env:testEnv});
  if(!baseline) {
    await stop(server);
    if(!focusBrowser)run('dotnet',['run','--project','tools/StoreMaintenance','-c','Release','--','verify-payment-contract','--settings',settingsPath]);
    if(focusPayments){console.log('Isolated payment transport checks completed.');}
    else{
    // Advance to the next TOTP interval so the replay guard remains enabled during this restart check.
    const nextInterval=30000-(Date.now()%30000)+100;
    await new Promise(resolve=>setTimeout(resolve,nextInterval));
    // The API settings suite leaves deposits disabled; preserve its exact values for restart assertions.
    // Browser-only runs skip that suite and explicitly clear only their own isolated fixture.
    if(focusBrowser)await db.execute("UPDATE payment_settings SET bank_transfer_enabled=FALSE,account_holder='',iban='',bic='',version=version+1 WHERE id=1");
    server=await start('dotnet',[path.join(publish,'Thesamenot.Api.dll')],publish,{
      ASPNETCORE_ENVIRONMENT:'Development',ASPNETCORE_URLS:apiUrl,Auth__LoginPermitLimit:'5',Auth__AccountPermitLimit:'20',Merchant__TaxRateBasisPoints:'2100',BankTransfer__Iban:''
    },'api-restart');
    await ready(apiUrl+'/api/health',server);
    run('node',['--test','frontend/tests-api/manual-payments.test.mjs'],{env:{...testEnv,API_TEST_BANK_UNCONFIGURED:'true'}});
    run('node',['--test','frontend/tests-api/auth-boundaries.test.mjs'],{env:testEnv});
    }
  }
  console.log('Isolated phase 1 checks completed.');
} finally {
  for (const child of children.reverse()) {
    await stop(child);
  }
  if (db) {
    if (created && /^phase1_[a-f0-9]{12}_test$/.test(database)) await db.query('DROP DATABASE ' + database);
    await db.end();
  }
}
