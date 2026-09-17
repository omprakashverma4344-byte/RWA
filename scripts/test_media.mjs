import crypto from 'crypto';
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const KEY = '638udh3829162018', IV = 'fedcba9876543210';
function dec(enc) {
  try {
    if (!enc) return '';
    const b64 = enc.includes(':') ? enc.split(':')[0] : enc;
    const d = crypto.createDecipheriv('aes-128-cbc', KEY, IV);
    return d.update(b64, 'base64', 'utf8') + d.final('utf8');
  } catch { return ''; }
}
const row = await db.content.findUnique({ where: { id: '735:334864' } });
console.log('row found:', Boolean(row), '| fileLink:', row?.fileLink?.slice(0, 40));
let extra = {};
try { extra = row?.extraJson ? JSON.parse(row.extraJson) : {}; } catch {}
console.log('extraJson keys:', Object.keys(extra));
const urls = [];
for (const [i, q] of (extra.encrypted_links ?? []).entries()) {
  const u = dec(q.path);
  urls.push({ type: 'enc_links', quality: q.quality, url: u });
}
for (const [i, q] of (extra.download_links ?? []).entries()) {
  const u = dec(q.path);
  urls.push({ type: 'download_links', quality: q.quality, url: u });
}
urls.push({ type: 'file_link', quality: 'orig', url: dec(row?.fileLink) });
for (const u of urls) {
  if (!u.url) { console.log(u.type, u.quality, 'DECRYPT FAIL'); continue; }
  const short = u.url.length > 110 ? u.url.slice(0, 60) + ' ... ' + u.url.slice(-40) : u.url;
  try {
    const r = await fetch(u.url, { headers: { Range: 'bytes=0-99' }, redirect: 'follow' });
    console.log(`${u.type}/${u.quality}: HTTP ${r.status} ${r.headers.get('content-type') ?? ''} :: ${short}`);
  } catch (e) {
    console.log(`${u.type}/${u.quality}: FETCH ERR ${e.message} :: ${short}`);
  }
}
await db.$disconnect();
