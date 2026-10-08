import net from 'node:net';
import tls from 'node:tls';
import {writeFile} from 'node:fs/promises';
const [host,port,path]=process.argv.slice(2);
if(!host||!port||!path)throw new Error('Usage: node inspect-certificate.mjs HOST PORT OUTPUT_JSON');
const socket=net.connect(Number(port),host);
socket.setTimeout(10000,()=>socket.destroy(new Error('Timeout')));
socket.once('data',()=>{
 const body=Buffer.alloc(32);body.writeUInt32LE(1|4|512|2048|8192|32768|524288,0);body.writeUInt32LE(16777216,4);body[8]=45;
 socket.write(Buffer.concat([Buffer.from([32,0,0,1]),body]));
 // Observe the public certificate only: no authentication packet or password is sent.
 const secure=tls.connect({socket,servername:host,rejectUnauthorized:false},async()=>{
  const certificate=secure.getPeerCertificate();
  const pin=certificate.fingerprint256.replaceAll(':','');
  await writeFile(path,JSON.stringify({sha256:pin,validFrom:certificate.valid_from,validTo:certificate.valid_to,subject:certificate.subject,issuer:certificate.issuer}));
  console.log(JSON.stringify({sha256:pin,subject:certificate.subject,validTo:certificate.valid_to}));
  secure.end();
 });
 secure.on('error',e=>{console.error(e.message);process.exitCode=1;});
});
socket.on('error',e=>{console.error(e.message);process.exitCode=1;});