/**
 * Bulk scraper for Study Bison.
 * Crawls all batches -> subjects -> topics -> content from the upstream API
 * and stores everything in SQLite via Prisma.
 *
 * Run with: bun run scripts/scrape.ts
 * Progress is written to /home/z/my-project/db/scrape-status.json
 */
import { PrismaClient } from "@prisma/client";
import {
  fetchBatchList,
  api,
  classifyContent,
  type UpstreamContent,
} from "../src/lib/upstream";
import fs from "fs";
import path from "path";

const db = new PrismaClient();
const STATUS_FILE = path.join(__dirname, "..", "db", "scrape-status.json");
const CONCURRENCY = 2;
const BATCH_DELAY_MS = 700;

interface Status {
  startedAt: string;
  updatedAt: string;
  totalBatches: number;
  doneBatches: number;
  currentBatch?: string;
  subjects: number;
  topics: number;
  contents: number;
  videos: number;
  pdfs: number;
  errors: number;
  finished: boolean;
  log: string[];
}

const status: Status = {
  startedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  totalBatches: 0,
  doneBatches: 0,
  subjects: 0,
  topics: 0,
  contents: 0,
  videos: 0,
  pdfs: 0,
  errors: 0,
  finished: false,
  log: [],
};

function saveStatus() {
  status.updatedAt = new Date().toISOString();
  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
  } catch {
    /* ignore */
  }
}

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  status.log.push(line);
  if (status.log.length > 200) status.log.shift();
  console.log(line);
}

async function scrapeBatch(batchId: string) {
  const subjectsRes = await api.subjects(batchId);
  const subjects = Array.isArray(subjectsRes.data) ? subjectsRes.data : [];
  if (subjectsRes.status !== 200) {
    status.errors++;
    log(
      `batch ${batchId}: subjects fetch failed (${subjectsRes.status} ${subjectsRes.error || ""})`
    );
    throw new Error(`subjects ${subjectsRes.status}`);
  }

  for (const s of subjects) {
    const sid = String(s.subjectid);
    const id = `${batchId}:${sid}`;
    await db.subject.upsert({
      where: { id },
      update: {
        subjectName: s.subject_name ?? "",
        subjectLogo: s.subject_logo || null,
        isPaid: String(s.is_paid ?? "1"),
        sortParam: String(s.sortingparam ?? "0"),
        scrapedAt: new Date(),
      },
      create: {
        id,
        subjectId: sid,
        courseId: batchId,
        subjectName: s.subject_name ?? "",
        subjectLogo: s.subject_logo || null,
        isPaid: String(s.is_paid ?? "1"),
        sortParam: String(s.sortingparam ?? "0"),
        scrapedAt: new Date(),
      },
    });
    status.subjects++;

    const topicsRes = await api.topics(batchId, sid);
    const topics = Array.isArray(topicsRes.data) ? topicsRes.data : [];
    for (const t of topics) {
      const tid = String(t.topicid);
      const topicPk = `${batchId}:${sid}:${tid}`;
      await db.topic.upsert({
        where: { id: topicPk },
        update: {
          topicName: t.topic_name ?? "",
          topicLogo: t.topic_logo || null,
          scrapedAt: new Date(),
        },
        create: {
          id: topicPk,
          topicId: tid,
          courseId: batchId,
          subjectId: sid,
          subjectRefId: id,
          topicName: t.topic_name ?? "",
          topicLogo: t.topic_logo || null,
          sortParam: String(t.sortingparam ?? "0"),
          scrapedAt: new Date(),
        },
      });
      status.topics++;

      const contentRes = await api.content(batchId, sid, tid);
      const items = Array.isArray(contentRes.data) ? contentRes.data : [];
      for (const item of items) {
        await upsertContent(batchId, sid, tid, topicPk, item);
      }
    }
  }

  // update batch aggregates
  const [videoCount, pdfCount, subjectCount] = await Promise.all([
    db.content.count({ where: { courseId: batchId, materialType: "VIDEO" } }),
    db.content.count({ where: { courseId: batchId, materialType: "PDF" } }),
    db.subject.count({ where: { courseId: batchId } }),
  ]);
  await db.batch.update({
    where: { batchId },
    data: { videoCount, pdfCount, subjectCount, scrapedAt: new Date() },
  });
}

async function upsertContent(
  courseId: string,
  subjectId: string,
  topicId: string,
  topicRefId: string,
  item: UpstreamContent
) {
  const cid = String(item.id);
  if (!cid) return;
  const pk = `${courseId}:${cid}`;
  const type = classifyContent(item);
  const safe = (v: unknown) => (v === undefined || v === null ? null : String(v));
  const extra: Record<string, unknown> = {};
  if (item.download_links) extra.download_links = item.download_links;
  if (item.encrypted_links) extra.encrypted_links = item.encrypted_links;

  const data = {
    title: item.Title ?? "Untitled",
    materialType: type,
    thumbnail: safe(item.thumbnail),
    fileLink: safe(item.file_link),
    pdfLink: safe(item.pdf_link),
    pdfLink2: safe(item.pdf_link2),
    embedUrl: safe(item.embed_url),
    dateAndTime: safe(item.date_and_time),
    strtotime: safe(item.strtotime),
    duration: item.duration !== undefined ? String(item.duration) : null,
    liveStatus: safe(item.live_status),
    isEncrypted: true,
    extraJson: Object.keys(extra).length ? JSON.stringify(extra) : null,
  };

  await db.content.upsert({
    where: { id: pk },
    update: { ...data, updatedAt: new Date() },
    create: {
      id: pk,
      contentId: cid,
      courseId,
      subjectId,
      topicId,
      topicRefId,
      ...data,
    },
  });
  status.contents++;
  if (type === "VIDEO") status.videos++;
  else if (type === "PDF") status.pdfs++;
}

async function main() {
  const mode = process.argv[2] || "full";
  log(`scraper started (mode=${mode})`);

  // 1. Batch list
  let batches: Awaited<ReturnType<typeof fetchBatchList>> = [];
  try {
    batches = await fetchBatchList();
  } catch (e) {
    log(`ERROR fetching batch.json: ${e}`);
    saveStatus();
    process.exit(1);
  }
  status.totalBatches = batches.length;
  log(`fetched batch list: ${batches.length} batches`);

  for (const b of batches) {
    await db.batch.upsert({
      where: { batchId: String(b.batch_id) },
      update: {
        batchName: b.batch_name,
        thumbUrl: b.thumb_url || null,
        price: String(b.price ?? "0"),
        startDate: b.start_date || null,
        endDate: b.end_date || null,
      },
      create: {
        batchId: String(b.batch_id),
        batchName: b.batch_name,
        thumbUrl: b.thumb_url || null,
        price: String(b.price ?? "0"),
        startDate: b.start_date || null,
        endDate: b.end_date || null,
      },
    });
  }
  log("batch list persisted");

  if (mode === "list") {
    status.finished = true;
    saveStatus();
    log("list mode done");
    return;
  }

  // 2. Crawl each batch with a worker pool (two passes for rate-limit failures)
  const queue = batches.map((b) => String(b.batch_id));
  let cursor = 0;

  async function worker() {
    while (cursor < queue.length) {
      const batchId = queue[cursor++];
      status.currentBatch = batchId;
      try {
        await scrapeBatch(batchId);
        status.doneBatches++;
        if (status.doneBatches % 5 === 0) {
          log(
            `progress: ${status.doneBatches}/${status.totalBatches} batches | subjects=${status.subjects} topics=${status.topics} contents=${status.contents} errors=${status.errors}`
          );
        }
        saveStatus();
      } catch (e) {
        status.errors++;
        failedQueue.push(batchId);
        status.doneBatches++;
        log(`ERROR batch ${batchId}: ${e instanceof Error ? e.message : e}`);
        saveStatus();
      }
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  const failedQueue: string[] = [];
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  // second pass for failed batches (rate limits usually clear)
  if (failedQueue.length > 0) {
    log(`second pass: retrying ${failedQueue.length} failed batches`);
    status.doneBatches -= failedQueue.length;
    const retryQueue = [...failedQueue];
    failedQueue.length = 0;
    queue.length = 0;
    queue.push(...retryQueue);
    cursor = 0;
    await new Promise((r) => setTimeout(r, 5000));
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  }

  status.finished = true;
  saveStatus();
  log(
    `SCRAPING COMPLETE: batches=${status.doneBatches}/${status.totalBatches} subjects=${status.subjects} topics=${status.topics} contents=${status.contents} (videos=${status.videos}, pdfs=${status.pdfs}) errors=${status.errors}`
  );
}

main()
  .catch((e) => {
    log(`FATAL: ${e}`);
    saveStatus();
    process.exit(1);
  })
  .finally(() => db.$disconnect());

process.on("unhandledRejection", (reason) => {
  log(`unhandledRejection: ${reason instanceof Error ? reason.stack : reason}`);
  saveStatus();
});
process.on("uncaughtException", (err) => {
  log(`uncaughtException: ${err.stack}`);
  saveStatus();
});
// periodic heartbeat so we know the process is alive
setInterval(() => {
  saveStatus();
}, 10000);
