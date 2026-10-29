import {randomBytes} from 'node:crypto';
import {mkdir,copyFile,readdir,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import mysql from '../frontend/node_modules/mysql2/promise.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const database='phase1_'+randomBytes(6).toString('hex')+'_test';
if(!/^phase1_[a-f0-9]{12}_test$/.test(database))throw new Error('Unsafe fixture name');
const fixture=path.join(root,'.local','phase1','setup-'+database);
const content=path.join(fixture,'backend','Thesamenot.Api','Database');
await mkdir(path.join(content,'Migrations'),{recursive:true});
const original=path.join(root,'backend','Thesamenot.Api','Database');
await copyFile(path.join(original,'schema.sql'),path.join(content,'schema.sql'));
for(const file of await readdir(path.join(original,'Migrations')))
 if(/^[0-9]{3}_[a-z_]+[.]sql$/.test(file))await copyFile(path.join(original,'Migrations',file),path.join(content,'Migrations',file));
const db=await mysql.createConnection({host:'127.0.0.1',port:13307,user:'root'});
const execute=()=>spawnSync('dotnet',['run','--project','tools/StoreSetup','-c','Release','--','--root',fixture,'--non-interactive','--host','127.0.0.1','--port','13307','--database',database],{
 cwd:root,encoding:'utf8',windowsHide:true,
 env:{...process.env,STORE_SETUP_ADMIN_PASSWORD:'Fixture-9!'+randomBytes(20).toString('hex'),STORE_SETUP_DB_PASSWORD:''}
});
try{
 const result=execute();assert.equal(result.status,0,'Explicit isolated new-store setup must succeed');
 const [ledger]=await db.query('SELECT COUNT(*) n FROM '+database+'.schema_migrations WHERE state=?',['applied']);
 assert.equal(ledger[0].n,(await readdir(path.join(original,'Migrations'))).filter(file=>file.endsWith('.sql')).length);
 const config=JSON.parse(await readFile(path.join(fixture,'backend','Thesamenot.Api','appsettings.Local.json'),'utf8'));
 assert.equal(config.Store.PaymentMode,'Manual');
 const connection=Object.fromEntries(config.ConnectionStrings.Store.split(';').filter(Boolean).map(part=>{const index=part.indexOf('=');return[part.slice(0,index).trim().toLowerCase(),part.slice(index+1).trim()];}));
 const runtime=await mysql.createConnection({host:connection.server,port:Number(connection.port),database:connection.database,user:connection['user id'],password:connection.password});
 try{
  await runtime.query("UPDATE products SET name=name WHERE id='hood'");
  await assert.rejects(runtime.query('CREATE TABLE setup_ddl_probe (id INT)'),error=>error.errno===1142);
 }finally{await runtime.end();}
 const repeated=execute();assert.notEqual(repeated.status,0,'Existing configuration must be refused');
 const [again]=await db.query('SELECT COUNT(*) n FROM '+database+'.products');assert.equal(again[0].n,2);
 console.log('New-store setup applied all migrations with a DML runtime account; repeated setup refused without changing existing data.');
}finally{
 // Names are generated above and are never supplied by the caller.
 await db.query('DROP DATABASE IF EXISTS '+database);
 for(const host of ['localhost','127.0.0.1'])await db.query("DROP USER IF EXISTS '"+database+"_app'@'"+host+"'");
 await db.end();
}
