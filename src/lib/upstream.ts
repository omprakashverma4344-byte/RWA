import crypto from "crypto";

/**
 * Upstream API client for the teachx proxy.
 * Mirrors the exact behaviour of the original site's JS bundle:
 * - GET https://rwaproxy.studymatexrwa.workers.dev/teachx-proxy?path=<encoded>&<params>
 * - header x-app-key: rwa_proxy_f8G3kL9mN2pQ4rS6tU1vW5xY7zA0bC9dE
 */

export const UPSTREAM_BASE =
  "https://rwaproxy.studymatexrwa.workers.dev/teachx-proxy";

export const APP_KEY = "rwa_proxy_f8G3kL9mN2pQ4rS6tU1vW5xY7zA0bC9dE";

// AES-128-CBC decryption keys (extracted + verified from original bundle)
const AES_KEY = "638udh3829162018";
const AES_IV = "fedcba9876543210";

/** Decrypt an upstream encrypted link (base64[:base64-of-iv]) into a plain URL. */
export function decryptLink(enc?: string | null): string {
  try {
    if (!enc) return "";
    const b64 = enc.includes(":") ? enc.split(":")[0] : enc;
    const decipher = crypto.createDecipheriv("aes-128-cbc", AES_KEY, AES_IV);
    let out = decipher.update(b64, "base64", "utf8");
    out += decipher.final("utf8");
    return out;
  } catch {
    return "";
  }
}

export function isEncrypted(s?: string | null): boolean {
  if (!s) return false;
  return s.includes(":") || !/^(https?:|\/\/)/i.test(s);
}

export interface UpstreamResult<T = unknown> {
  status: number;
  msg?: string;
  message?: string;
  data?: T;
  error?: string;
}

/** Thrown when upstream is rate-limited and no cached data exists. */
export class UpstreamBusyError extends Error {
  constructor() {
    super("upstream busy");
  }
}

export async function upstreamFetch<T = unknown>(
  path: string,
  params: Record<string, string | number | undefined>,
  timeoutMs = 20000
): Promise<UpstreamResult<T>> {
  const search = new URLSearchParams();
  search.set("path", path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) search.set(k, String(v));
  }
  const url = `${UPSTREAM_BASE}?${search.toString()}`;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "x-app-key": APP_KEY },
      signal: controller.signal,
      cache: "no-store",
    });
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after")) || 5;
      return { status: 429, error: `rate-limited, retry after ${retryAfter}s` };
    }
    const json = (await res.json()) as UpstreamResult<T>;
    return json;
  } catch (e) {
    return {
      status: -1,
      error: e instanceof Error ? e.message : "upstream fetch failed",
    };
  } finally {
    clearTimeout(t);
  }
}

/** Retry wrapper with exponential backoff; honours 429 rate limits. */
export async function upstreamFetchWithRetry<T = unknown>(
  path: string,
  params: Record<string, string | number | undefined>,
  retries = 2
): Promise<UpstreamResult<T>> {
  let last: UpstreamResult<T> = { status: -1 };
  for (let i = 0; i <= retries; i++) {
    last = await upstreamFetch<T>(path, params);
    if (last.status === 200 && last.data !== undefined) return last;
    if (i < retries) {
      const wait = last.status === 429 ? 2000 * (i + 1) : 1200 * (i + 1);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  return last;
}

// ---------------- Typed upstream endpoints ----------------

export interface UpstreamSubject {
  subjectid: string;
  subject_name: string;
  subject_logo?: string;
  sortingparam?: string;
  is_paid?: string;
}

export interface UpstreamTopic {
  topicid: string;
  topic_name: string;
  topic_logo?: string;
  sortingparam?: number | string;
}

export interface UpstreamDownloadLink {
  quality?: string;
  bitrate?: string;
  path?: string;
  backup_url?: string;
  backup_url2?: string;
}

export interface UpstreamContent {
  id: string;
  Title?: string;
  material_type?: string;
  file_link?: string;
  pdf_link?: string;
  pdf_link2?: string;
  embed_url?: string;
  thumbnail?: string;
  date_and_time?: string;
  strtotime?: string;
  duration?: string | number;
  live_status?: string;
  enc_type?: string;
  iv_string?: string;
  download_links?: UpstreamDownloadLink[];
  [k: string]: unknown;
}

export const api = {
  subjects: (courseId: string) =>
    upstreamFetchWithRetry<UpstreamSubject[]>("/get/allsubjectfrmlivecourseclass", {
      courseid: courseId,
      start: "-1",
    }),

  topics: (courseId: string, subjectId: string) =>
    upstreamFetchWithRetry<UpstreamTopic[]>("/get/alltopicfrmlivecourseclass", {
      courseid: courseId,
      subjectid: subjectId,
      start: "-1",
    }),

  content: (courseId: string, subjectId: string, topicId: string) =>
    upstreamFetchWithRetry<UpstreamContent[]>(
      "/get/livecourseclassbycoursesubtopconceptapiv3",
      { courseid: courseId, subjectid: subjectId, topicid: topicId, conceptid: "", start: "-1" }
    ),

  videoDetails: (courseId: string, videoId: string) =>
    upstreamFetch<UpstreamContent>("/get/fetchVideoDetailsById", {
      course_id: courseId,
      video_id: videoId,
      ytflag: "0",
      folder_wise_course: "0",
    }),

  tests: (courseId: string, userId = "guest") =>
    upstreamFetchWithRetry<unknown>("/get/test_seriesbycourseid", {
      courseid: courseId,
      userid: userId,
      folder_wise_course: "0",
      start: "-1",
    }),

  liveUpcoming: (courseId: string, userId = "guest") =>
    upstreamFetchWithRetry<unknown>("/get/live_upcoming_course_classv2", {
      courseid: courseId,
      userid: userId,
      start: "-1",
      folder_wise_course: "0",
    }),

  previousLive: (courseId: string, userId = "guest") =>
    upstreamFetchWithRetry<unknown>("/get/get_previous_live_videos", {
      course_id: courseId,
      start: "-1",
      folder_wise_course: "0",
      user_id: userId,
    }),
};

export interface BatchListItem {
  batch_id: string;
  batch_name: string;
  thumb_url?: string;
  price?: string;
  start_date?: string;
  end_date?: string;
}

export async function fetchBatchList(): Promise<BatchListItem[]> {
  const res = await fetch("https://rwaweb.vercel.app/batch.json", {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`batch.json ${res.status}`);
  return (await res.json()) as BatchListItem[];
}

/** Classify a content item into VIDEO / PDF / OTHER buckets (mirrors original UI). */
export function classifyContent(item: UpstreamContent): "VIDEO" | "PDF" | "OTHER" {
  const t = (item.material_type || "").toUpperCase();
  if (t === "VIDEO") return "VIDEO";
  if (t === "PDF" || t === "NOTE" || t === "NOTES") return "PDF";
  if (item.embed_url) return "VIDEO";
  if (item.pdf_link || item.pdf_link2) return "PDF";
  if (item.file_link) return "VIDEO";
  return "OTHER";
}
