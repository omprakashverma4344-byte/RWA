import crypto from 'crypto';
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const KEY = '638udh3829162018', IV = 'fedcba9876543210';
const APP = 'rwa_proxy_f8G3kL9mN2pQ4rS6tU1vW5xY7zA0bC9dE';
function dec(enc) {
  try {
    if (!enc) return '';
    const b64 = enc.includes(':') ? enc.split(':')[0] : enc;
    const d = crypto.createDecipheriv('aes-128-cbc', KEY, IV);
    return d.update(b64, 'base64', 'utf8') + d.final('utf8');
  } catch { return ''; }
}
const url = 'https://rwaproxy.studymatexrwa.workers.dev/teachx-proxy?path=%2Fget%2FfetchVideoDetailsById&course_id=735&video_id=334864&ytflag=0&folder_wise_course=0';
const CONTENT_ID = '334864';
const COURSE_ID = '735';

for (let i = 0; i < 500; i++) {
  try {
    const res = await fetch(url, { headers: { 'x-app-key': APP } });
    if (i % 4 === 0 || res.status === 200) {
      console.log(`[${new Date().toISOString()}] probe ${i}: ${res.status}`);
    }
    if (res.status === 200) {
      const j = await res.json();
      const d = j?.data;
      if (!d) { await Bun.sleep(25000); continue; }
      const videoUrl = dec(d.file_link) || null;
      const qualities = [];
      for (const q of d.encrypted_links ?? []) {
        const u = dec(q.path);
        if (u && q.quality) qualities.push({ quality: q.quality, url: u });
      }
      for (const q of d.download_links ?? []) {
        const u = dec(q.path);
        if (u && q.quality && !qualities.some((x) => x.quality === q.quality))
          qualities.push({ quality: q.quality, url: u });
      }
      qualities.sort((a, b) => parseInt(b.quality) - parseInt(a.quality));
      const hlsUrl = qualities.find((q) => q.url.includes('.m3u8'))?.url ?? null;
      await db.mediaResolve.upsert({
        where: { contentId: CONTENT_ID },
        update: {
          videoUrl,
          hlsUrl,
          qualities: qualities.length ? JSON.stringify(qualities) : null,
          updatedAt: new Date(),
        },
        create: {
          contentId: CONTENT_ID,
          courseId: COURSE_ID,
          videoUrl,
          hlsUrl,
          qualities: qualities.length ? JSON.stringify(qualities) : null,
        },
      });
      console.log('=== SEEDED FRESH RESOLVE ===');
      console.log('mp4:', videoUrl);
      console.log('hls:', hlsUrl?.slice(0, 110));
      const test = videoUrl ? await fetch(videoUrl, { headers: { Range: 'bytes=0-99' } }) : null;
      console.log('mp4 CDN check:', test?.status);
      await Bun.write('/tmp/fresh_video_334864.json', JSON.stringify(j));
      console.log('DONE — window caught at', new Date().toISOString());
      break;
    }
  } catch (e) {
    console.log('probe error:', e.message);
  }
  await Bun.sleep(20000);
}
await db.$disconnect();
