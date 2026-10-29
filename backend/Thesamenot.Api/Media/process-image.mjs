import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require(process.env.STORE_SHARP_MODULE);
sharp.concurrency(1);
sharp.cache(false);
try {
  const chunks = []; let length = 0;
  for await (const chunk of process.stdin) {
    length += chunk.length;
    if (length > 6 * 1024 * 1024) throw new Error('size');
    chunks.push(chunk);
  }
  const bytes=Buffer.concat(chunks),mime=process.argv[2];
  const signature=mime==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):
    mime==='image/jpeg'?bytes.length>3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255:
    mime==='image/webp'?bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP':false;
  if(!signature)throw new Error('signature');
  const input = sharp(bytes, { limitInputPixels: 12000000, failOn: 'warning', animated: false });
  const metadata = await input.metadata();
  const format = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' }[process.argv[2]];
  if (!format || metadata.format !== format || !metadata.width || !metadata.height ||
      metadata.width > 4096 || metadata.height > 4096 || (metadata.pages ?? 1) !== 1) throw new Error('format');
  const { data, info } = await input.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 }).timeout({ seconds: 8 }).toBuffer({ resolveWithObject: true });
  const header = Buffer.alloc(8);
  header.writeInt32LE(info.width, 0);
  header.writeInt32LE(info.height, 4);
  process.stdout.write(header); process.stdout.write(data);
} catch {
  process.stderr.write('Invalid or unsupported image');
  process.exitCode = 1;
}
