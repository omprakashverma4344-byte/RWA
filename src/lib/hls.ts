"use client";

import Hls from "hls.js";

type HlsCtor = typeof Hls;

/**
 * Attaches a media source to a <video> element, transparently handling
 * progressive MP4 and HLS (m3u8) streams.
 * `onFail` is invoked when the source is unusable (fatal hls error,
 * element error, or no HLS support). Returns a cleanup function.
 */
export function attachSource(
  video: HTMLVideoElement,
  url: string,
  onFail?: (reason: string) => void
): () => void {
  const isHls = /\.m3u8(\?|$)/i.test(url);

  if (!isHls) {
    const onErr = () => onFail?.("element error");
    video.addEventListener("error", onErr, { once: true });
    video.src = url;
    return () => {
      video.removeEventListener("error", onErr);
      video.removeAttribute("src");
    };
  }

  // HLS
  if (video.canPlayType("application/vnd.apple.mpegurl")) {
    // Safari / iOS play natively
    const onErr = () => onFail?.("native hls error");
    video.addEventListener("error", onErr, { once: true });
    video.src = url;
    return () => {
      video.removeEventListener("error", onErr);
      video.removeAttribute("src");
    };
  }

  if (Hls.isSupported()) {
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      maxBufferLength: 30,
      fragLoadingMaxRetry: 2,
      manifestLoadingMaxRetry: 2,
      manifestLoadingRetryDelay: 1000,
      fragLoadingRetryDelay: 1000,
    } as ConstructorParameters<HlsCtor>[0]);
    let failed = false;
    const fail = (reason: string) => {
      if (failed) return;
      failed = true;
      onFail?.(reason);
    };
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (!data.fatal) return;
      if (
        data.type === Hls.ErrorTypes.NETWORK_ERROR &&
        (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
          data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT ||
          data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR)
      ) {
        fail(`hls ${data.details}`);
      } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        try {
          hls.recoverMediaError();
        } catch {
          fail("hls media error");
        }
      } else {
        fail(`hls ${data.type}:${data.details}`);
      }
    });
    hls.loadSource(url);
    hls.attachMedia(video);
    // guard: if the manifest never loads, fail after a timeout
    const guard = setTimeout(() => {
      if (!failed && video.readyState === 0) fail("hls timeout");
    }, 20000);
    return () => {
      clearTimeout(guard);
      hls.destroy();
    };
  }

  // no HLS support at all
  onFail?.("hls unsupported");
  return () => undefined;
}

/** Ordered candidate sources for a resolved video. */
export interface SourceCandidate {
  url: string;
  kind: "mp4" | "hls" | "embed";
  label: string;
}

export function buildSourceCandidates(resolve: {
  videoUrl?: string | null;
  hlsUrl?: string | null;
  qualities?: { quality: string; url: string }[] | null;
  embedUrl?: string | null;
} | null): SourceCandidate[] {
  if (!resolve) return [];
  const out: SourceCandidate[] = [];
  const push = (
    url?: string | null,
    kind: SourceCandidate["kind"] = "mp4",
    label = "Auto"
  ) => {
    if (url && !out.some((s) => s.url === url)) out.push({ url, kind, label });
  };
  push(resolve.videoUrl?.includes(".mp4") ? resolve.videoUrl : null, "mp4", "Auto");
  for (const q of resolve.qualities ?? []) {
    push(q.url.includes(".mp4") ? q.url : null, "mp4", q.quality);
  }
  push(resolve.hlsUrl, "hls", "HLS");
  for (const q of resolve.qualities ?? []) {
    push(q.url.includes(".m3u8") ? q.url : null, "hls", `HLS ${q.quality}`);
  }
  if (out.length === 0) push(resolve.videoUrl, "mp4", "Auto");
  push(resolve.embedUrl, "embed", "Embed");
  return out;
}
