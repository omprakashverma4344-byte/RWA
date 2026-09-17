"use client";

export interface ApiBatch {
  batchId: string;
  batchName: string;
  thumbUrl?: string | null;
  price?: string;
  startDate?: string | null;
  endDate?: string | null;
  subjectCount?: number;
  videoCount?: number;
  pdfCount?: number;
}

export interface ApiSubject {
  subjectId: string;
  subjectName: string;
  subjectLogo?: string | null;
  isPaid?: string;
}

export interface ApiTopic {
  topicId: string;
  topicName: string;
  topicLogo?: string | null;
}

export interface ApiContent {
  id: string;
  contentId: string;
  courseId: string;
  subjectId: string;
  topicId: string;
  title: string;
  materialType: "VIDEO" | "PDF" | "OTHER";
  thumbnail?: string | null;
  dateAndTime?: string | null;
  strtotime?: string | null;
  duration?: string | null;
  liveStatus?: string | null;
  embedUrl?: string | null;
}

export interface VideoResolve {
  contentId: string;
  videoUrl?: string;
  hlsUrl?: string;
  qualities?: { quality: string; url: string }[];
  embedUrl?: string;
  error?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch JSON with automatic retry on 503 (upstream busy) and transient
 * network errors — mirrors the original site's "Servers are busy, retrying…".
 */
async function jsonFetch<T>(url: string, tries = 10): Promise<T> {
  let lastMsg = "request failed";
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 503) {
        lastMsg = "Servers are busy, retrying…";
        await sleep(6000);
        continue;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`API ${res.status}: ${text || res.statusText}`);
      }
      return (await res.json()) as T;
    } catch (e) {
      lastMsg = e instanceof Error ? e.message : String(e);
      if (i < tries - 1) await sleep(1500);
    }
  }
  throw new Error(lastMsg);
}

export const api = {
  batches: () => jsonFetch<ApiBatch[]>("/api/batches"),

  subjects: (batchId: string) =>
    jsonFetch<ApiSubject[]>(`/api/batches/${batchId}/subjects`),

  topics: (batchId: string, subjectId: string) =>
    jsonFetch<ApiTopic[]>(
      `/api/batches/${batchId}/subjects/${subjectId}/topics`
    ),

  content: (batchId: string, subjectId: string, topicId: string) =>
    jsonFetch<ApiContent[]>(
      `/api/batches/${batchId}/subjects/${subjectId}/topics/${topicId}/content`
    ),

  resolveVideo: (courseId: string, contentId: string, extra = "") =>
    jsonFetch<VideoResolve>(
      `/api/video/${contentId}?courseId=${encodeURIComponent(courseId)}${extra}`
    ),

  tests: (courseId: string) =>
    jsonFetch<unknown[]>(`/api/tests/${courseId}`),

  live: (courseId: string) =>
    jsonFetch<{ upcoming: unknown[]; previous: unknown[] }>(
      `/api/live/${courseId}`
    ),

  pdfStreamUrl: (url: string) =>
    `/api/pdf-proxy?url=${encodeURIComponent(url)}`,
};

export function formatDuration(seconds?: string | number | null): string {
  const s = Number(seconds ?? 0);
  if (!s || Number.isNaN(s)) return "";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function formatPrice(price?: string | null): string {
  const p = Number(price ?? 0);
  if (!p || p < 0) return "Free";
  return `₹${p.toLocaleString("en-IN")}`;
}

export function isBatchNew(batch?: { startDate?: string | null } | null): boolean {
  if (!batch?.startDate) return false;
  const start = new Date(batch.startDate);
  if (Number.isNaN(start.getTime())) return false;
  return Date.now() - start.getTime() < 30 * 24 * 60 * 60 * 1000;
}
