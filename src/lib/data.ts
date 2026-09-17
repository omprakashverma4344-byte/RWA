import "server-only";
import { db } from "@/lib/db";
import {
  api,
  classifyContent,
  decryptLink,
  UpstreamBusyError,
  type UpstreamContent,
} from "@/lib/upstream";

const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6h for structural data

function fresh(d: Date | null | undefined, ttl = CACHE_TTL_MS): boolean {
  if (!d) return false;
  return Date.now() - new Date(d).getTime() < ttl;
}

export async function getBatches() {
  return db.batch.findMany({
    orderBy: { startDate: "desc" },
  });
}

export async function getSubjects(courseId: string) {
  const cached = await db.subject.findMany({
    where: { courseId },
    orderBy: [{ sortParam: "asc" }, { subjectName: "asc" }],
  });
  if (cached.length > 0 && cached.every((s) => fresh(s.scrapedAt)))
    return cached;

  // refresh from upstream; on busy/429 fall back to whatever we have on disk
  try {
    const res = await api.subjects(courseId);
    if (res.status === 200 && Array.isArray(res.data)) {
      for (const s of res.data) {
        const sid = String(s.subjectid);
        const pk = `${courseId}:${sid}`;
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
            courseId,
            subjectName: s.subject_name ?? "",
            subjectLogo: s.subject_logo || null,
            isPaid: String(s.is_paid ?? "1"),
            sortParam: String(s.sortingparam ?? "0"),
            scrapedAt: new Date(),
          },
        });
      }
      if (res.data.length > 0)
        await db.batch.update({
          where: { batchId: courseId },
          data: { subjectCount: res.data.length, scrapedAt: new Date() },
        }).catch(() => undefined);
      return db.subject.findMany({
        where: { courseId },
        orderBy: [{ sortParam: "asc" }, { subjectName: "asc" }],
      });
    }
  } catch (e) {
    if (!(e instanceof UpstreamBusyError)) throw e;
  }

  if (cached.length > 0) return cached; // stale but browsable
  throw new UpstreamBusyError();
}

export async function getTopics(courseId: string, subjectId: string) {
  const cached = await db.topic.findMany({
    where: { courseId, subjectId },
    orderBy: [{ sortParam: "asc" }, { topicName: "asc" }],
  });
  if (cached.length > 0 && cached.every((t) => fresh(t.scrapedAt)))
    return cached;

  try {
    const res = await api.topics(courseId, subjectId);
    if (res.status === 200 && Array.isArray(res.data)) {
      for (const t of res.data) {
        const tid = String(t.topicid);
        const pk = `${courseId}:${subjectId}:${tid}`;
        const subjectRow = await db.subject.findUnique({
          where: { id: `${courseId}:${subjectId}` },
        });
        await db.topic.upsert({
          where: { id: pk },
          update: {
            topicName: t.topic_name ?? "",
            topicLogo: t.topic_logo || null,
            scrapedAt: new Date(),
          },
          create: {
            id: pk,
            topicId: tid,
            courseId,
            subjectId,
            subjectRefId: subjectRow?.id ?? `${courseId}:${subjectId}`,
            topicName: t.topic_name ?? "",
            topicLogo: t.topic_logo || null,
            sortParam: String(t.sortingparam ?? "0"),
            scrapedAt: new Date(),
          },
        });
      }
      return db.topic.findMany({
        where: { courseId, subjectId },
        orderBy: [{ sortParam: "asc" }, { topicName: "asc" }],
      });
    }
  } catch (e) {
    if (!(e instanceof UpstreamBusyError)) throw e;
  }

  if (cached.length > 0) return cached; // stale but browsable
  throw new UpstreamBusyError();
}

export async function getContent(
  courseId: string,
  subjectId: string,
  topicId: string
) {
  const cached = await db.content.findMany({
    where: { courseId, subjectId, topicId },
    orderBy: [{ strtotime: "desc" }],
  });
  if (cached.length > 0) return cached;

  const res = await api.content(courseId, subjectId, topicId);
  if (res.status === 429 && cached.length === 0) throw new UpstreamBusyError();
  if (res.status === 200 && Array.isArray(res.data)) {
    for (const item of res.data) {
      await upsertContentItem(courseId, subjectId, topicId, item);
    }
    if (res.data.length > 0)
      return db.content.findMany({
        where: { courseId, subjectId, topicId },
        orderBy: [{ strtotime: "desc" }],
      });
  }
  return cached;
}

async function upsertContentItem(
  courseId: string,
  subjectId: string,
  topicId: string,
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
      topicRefId: `${courseId}:${subjectId}:${topicId}`,
      ...data,
    },
  });

  // Videos can carry an attached PDF — surface it as a separate entry
  // titled "<Title> (2)" exactly like the original site does.
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
        topicRefId: `${courseId}:${subjectId}:${topicId}`,
        ...pdfData,
      },
    });
  }
}

/**
 * Resolve a playable video URL for a content item.
 * The upstream generates EPHEMERAL CDN URLs (they 404 after a short window),
 * so we only trust a very fresh cache and otherwise re-fetch + decrypt.
 */
export async function resolveVideo(contentId: string, courseId: string, force = false) {
  const EPHEMERAL_TTL = 8 * 60 * 1000; // 8 minutes
  const cached = await db.mediaResolve.findUnique({
    where: { contentId },
  });
  if (!force && cached && fresh(cached.updatedAt, EPHEMERAL_TTL)) return cached;

  const res = await api.videoDetails(courseId, contentId);
  const data = res.data;
  if (!data) {
    // fall back to the encrypted link stored in our DB
    const row = await db.content.findUnique({ where: { id: `${courseId}:${contentId}` } });
    const url = row?.fileLink ? decryptLink(row.fileLink) : "";
    if (!url) {
      if (res.status === 429) throw new UpstreamBusyError();
      const saved0 = await db.mediaResolve.upsert({
        where: { contentId },
        update: { embedUrl: row?.embedUrl ?? null, updatedAt: new Date() },
        create: { contentId, courseId, embedUrl: row?.embedUrl ?? null },
      });
      return saved0;
    }
    const saved = await db.mediaResolve.upsert({
      where: { contentId },
      update: { videoUrl: url, embedUrl: row?.embedUrl ?? null, updatedAt: new Date() },
      create: { contentId, courseId, videoUrl: url, embedUrl: row?.embedUrl ?? null },
    });
    return saved;
  }

  const videoUrl = decryptLink(data.file_link) || undefined;

  // YouTube-only lectures carry an id + ytFlag instead of a file link; the
  // source platform feeds them to its player as a youtube.com/watch url.
  const ytFlag = String((data as Record<string, unknown>).ytFlag ?? (data as Record<string, unknown>).ytFlagWeb ?? "0");
  const ytId = String((data as Record<string, unknown>).video_id || (data as Record<string, unknown>).youtube_id || (data as Record<string, unknown>).yt_id || "");
  const embedUrl =
    ((data.embed_url as string) ||
      (ytId && ytFlag === "1" ? `https://www.youtube.com/watch?v=${ytId}` : "") ||
      undefined) as string | undefined;

  const qualities: { quality: string; url: string }[] = [];
  if (Array.isArray(data.encrypted_links)) {
    for (const q of data.encrypted_links) {
      const url = decryptLink(q.path);
      if (url && q.quality) qualities.push({ quality: q.quality, url });
    }
  }
  if (Array.isArray(data.download_links)) {
    for (const q of data.download_links) {
      const url = decryptLink(q.path);
      if (url && q.quality && !qualities.some((x) => x.quality === q.quality))
        qualities.push({ quality: q.quality, url });
    }
  }
  qualities.sort((a, b) => parseInt(b.quality) - parseInt(a.quality));

  const hlsUrl = qualities.find((q) => q.url.includes(".m3u8"))?.url;

  const saved = await db.mediaResolve.upsert({
    where: { contentId },
    update: {
      videoUrl: videoUrl ?? null,
      hlsUrl: hlsUrl ?? null,
      qualities: qualities.length ? JSON.stringify(qualities) : null,
      embedUrl: embedUrl ?? null,
      updatedAt: new Date(),
    },
    create: {
      contentId,
      courseId,
      videoUrl: videoUrl ?? null,
      hlsUrl: hlsUrl ?? null,
      qualities: qualities.length ? JSON.stringify(qualities) : null,
      embedUrl: embedUrl ?? null,
    },
  });
  return saved;
}

/** Decrypt the freshest PDF link for a content row (signed URLs expire). */
export async function resolvePdf(contentId: string, courseId: string) {
  // accept either the full row id ("course:content") or a bare contentId
  let row = await db.content
    .findUnique({ where: { id: contentId } })
    .catch(() => null);
  if (!row && courseId) {
    row = await db.content.findUnique({
      where: { id: `${courseId}:${contentId}` },
    });
  }
  if (!row) return null;
  // pdf_link2 is the primary in upstream; pdf_link secondary
  for (const enc of [row.pdfLink2, row.pdfLink]) {
    const url = decryptLink(enc);
    if (url) return url;
  }
  return null;
}

export async function getLive(courseId: string) {
  const cacheKey = `live:${courseId}`;
  const [upcomingRes, previousRes] = await Promise.all([
    api.liveUpcoming(courseId),
    api.previousLive(courseId),
  ]);
  await db.apiCache
    .upsert({
      where: { key: cacheKey },
      update: {
        value: JSON.stringify({ upcoming: upcomingRes.data ?? [], previous: previousRes.data ?? [] }),
      },
      create: {
        key: cacheKey,
        value: JSON.stringify({ upcoming: upcomingRes.data ?? [], previous: previousRes.data ?? [] }),
      },
    })
    .catch(() => undefined);
  return {
    upcoming: Array.isArray(upcomingRes.data) ? upcomingRes.data : [],
    previous: Array.isArray(previousRes.data) ? previousRes.data : [],
  };
}

export async function getTests(courseId: string) {
  const res = await api.tests(courseId);
  return Array.isArray(res.data) ? res.data : [];
}
