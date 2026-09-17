import { db } from "@/lib/db";
import {
  fetchBatchList,
  api,
  classifyContent,
  type UpstreamContent,
} from "@/lib/upstream";
import fs from "fs";
import path from "path";

/**
 * In-server crawler. Started via POST /api/scrape-admin, runs detached from
 * the request inside the Next.js server process and persists everything to
 * SQLite. Progress is mirrored to db/scrape-status.json for observability.
 */

export interface CrawlStatus {
  running: boolean;
  startedAt?: string;
  updatedAt: string;
  totalBatches: number;
  doneBatches: number;
  currentBatch?: string;
  subjects: number;
  topics: number;
  contents: number;
  errors: number;
  finished: boolean;
  log: string[];
}

const g = globalThis as unknown as {
  __bisonCrawlStatus?: CrawlStatus;
  __bisonCrawlStarted?: boolean;
};

const STATUS_FILE = path.join(process.cwd(), "db", "scrape-status.json");

export function getStatus(): CrawlStatus {
  if (!g.__bisonCrawlStatus) {
    // hydrate from disk if available
    try {
      if (fs.existsSync(STATUS_FILE)) {
        const raw = JSON.parse(fs.readFileSync(STATUS_FILE, "utf8"));
        g.__bisonCrawlStatus = { ...raw, running: false };
      }
    } catch {
      /* ignore */
    }
  }
  if (!g.__bisonCrawlStatus) {
    g.__bisonCrawlStatus = {
      running: false,
      updatedAt: new Date().toISOString(),
      totalBatches: 0,
      doneBatches: 0,
      subjects: 0,
      topics: 0,
      contents: 0,
      errors: 0,
      finished: false,
      log: [],
    };
  }
  return g.__bisonCrawlStatus;
}

function saveStatusToDisk() {
  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify(getStatus(), null, 2));
  } catch {
    /* ignore */
  }
}

function log(msg: string) {
  const st = getStatus();
  st.log.push(`[${new Date().toISOString()}] ${msg}`);
  if (st.log.length > 150) st.log.shift();
  st.updatedAt = new Date().toISOString();
  saveStatusToDisk();
}

const CONCURRENCY = 1;
const BATCH_DELAY_MS = 2500;

async function upsertContentItem(
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
  const st = getStatus();
  st.contents++;

  // Videos can carry an attached PDF (pdf_link / pdf_link2) — the original
  // site surfaces it as a separate PDF entry titled "<Title> (2)".
  if (type === "VIDEO" && (item.pdf_link || item.pdf_link2)) {
    const pdfPk = `${pk}:pdf2`;
    const pdfData = {
      title: `${item.Title ?? "Untitled"} (2)`,
      materialType: "PDF" as const,
      thumbnail: safe(item.thumbnail),
      fileLink: null,
      pdfLink: safe(item.pdf_link),
      pdfLink2: safe(item.pdf_link2),
      embedUrl: null,
      dateAndTime: safe(item.date_and_time),
      strtotime: safe(item.strtotime),
      duration: null,
      liveStatus: safe(item.live_status),
      isEncrypted: true,
      extraJson: null,
    };
    await db.content.upsert({
      where: { id: pdfPk },
      update: { ...pdfData, updatedAt: new Date() },
      create: {
        id: pdfPk,
        contentId: `${cid}:pdf2`,
        courseId,
        subjectId,
        topicId,
        topicRefId,
        ...pdfData,
      },
    });
    st.contents++;
  }
}

async function crawlBatch(batchId: string) {
  const st = getStatus();
  const subjectsRes = await api.subjects(batchId);
  const subjects = Array.isArray(subjectsRes.data) ? subjectsRes.data : [];
  if (subjectsRes.status !== 200) {
    st.errors++;
    throw new Error(`subjects ${subjectsRes.status}`);
  }

  for (const s of subjects) {
    const sid = String(s.subjectid);
    const pk = `${batchId}:${sid}`;
    await db.subject.upsert({
      where: { id: pk },
      update: {
        subjectName: s.subject_name ?? "",
        subjectLogo: s.subject_logo || null,
        isPaid: String(s.is_paid ?? "1"),
        sortParam: String(s.sortingparam ?? "0"),
        scrapedAt: new Date(),
      },
      create: {
        id: pk,
        subjectId: sid,
        courseId: batchId,
        subjectName: s.subject_name ?? "",
        subjectLogo: s.subject_logo || null,
        isPaid: String(s.is_paid ?? "1"),
        sortParam: String(s.sortingparam ?? "0"),
        scrapedAt: new Date(),
      },
    });
    st.subjects++;

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
          subjectRefId: pk,
          topicName: t.topic_name ?? "",
          topicLogo: t.topic_logo || null,
          sortParam: String(t.sortingparam ?? "0"),
          scrapedAt: new Date(),
        },
      });
      st.topics++;

      const contentRes = await api.content(batchId, sid, tid);
      const items = Array.isArray(contentRes.data) ? contentRes.data : [];
      for (const item of items) {
        await upsertContentItem(batchId, sid, tid, topicPk, item);
      }
    }
  }

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

export function startCrawl(): CrawlStatus {
  const st = getStatus();
  if (g.__bisonCrawlStarted) return st;
  g.__bisonCrawlStarted = true;
  st.running = true;
  st.startedAt = new Date().toISOString();
  st.finished = false;
  log("crawl started (in-server)");

  void (async () => {
    try {
      const batches = await fetchBatchList();
      st.totalBatches = batches.length;
      log(`batch list fetched: ${batches.length}`);

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

      const queue = batches.map((b) => String(b.batch_id));
      const failed: string[] = [];
      let cursor = 0;
      const PAUSE_FILE = path.join(process.cwd(), "db", "crawl-pause");

      async function worker() {
        while (cursor < queue.length) {
          const batchId = queue[cursor++];
          st.currentBatch = batchId;
          try {
            await crawlBatch(batchId);
          } catch (e) {
            failed.push(batchId);
            st.errors++;
            log(`ERROR batch ${batchId}: ${e instanceof Error ? e.message : e}`);
            // adaptive backoff on rate-limit errors
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes("429")) {
              log("rate limited — cooling down 20s");
              await new Promise((r) => setTimeout(r, 20000));
            }
          }
          st.doneBatches++;
          if (st.doneBatches % 10 === 0) {
            log(
              `progress: ${st.doneBatches}/${st.totalBatches} | subjects=${st.subjects} topics=${st.topics} contents=${st.contents} errors=${st.errors}`
            );
          }
          // honour pause file for interactive testing
          let waited = 0;
          while (fs.existsSync(PAUSE_FILE) && waited < 120000) {
            await new Promise((r) => setTimeout(r, 2000));
            waited += 2000;
          }
          await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
        }
      }

      await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

      // retry failed once
      if (failed.length > 0) {
        log(`retry pass for ${failed.length} failed batches`);
        await new Promise((r) => setTimeout(r, 8000));
        queue.length = 0;
        queue.push(...failed);
        failed.length = 0;
        cursor = 0;
        st.doneBatches -= queue.length;
        await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
      }

      st.finished = true;
      st.running = false;
      log(
        `CRAWL COMPLETE: ${st.doneBatches}/${st.totalBatches} batches, subjects=${st.subjects}, topics=${st.topics}, contents=${st.contents}, errors=${st.errors}`
      );
    } catch (e) {
      st.running = false;
      log(`FATAL: ${e instanceof Error ? e.message : e}`);
    } finally {
      saveStatusToDisk();
      g.__bisonCrawlStarted = false;
    }
  })();

  return st;
}
