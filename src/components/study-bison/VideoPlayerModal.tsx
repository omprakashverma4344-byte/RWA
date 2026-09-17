"use client";

/**
 * Golden Theater — Study Bison's premium lecture player.
 *
 * STREAM mode (default): resolves a FRESH direct stream link (mp4 / HLS / YT)
 *   through our API, then embeds ONLY the source platform's dedicated player
 *   page — workers.dev/player?url=<stream>&title=<title> — inside the golden
 *   stage. This is exactly how the original site plays lectures (its own modal
 *   is an iframe of that player page). No site chrome, no login, no lists —
 *   just the player. Links are ephemeral, so the gold Reload button (and the
 *   busy-retry loop) always force-resolves a fresh link at play time.
 *
 * NATIVE mode: Study Bison's own golden video player (direct mp4 / HLS with
 *   adaptive-quality fallback) for when a fresh direct stream is available.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ApiContent, type VideoResolve } from "@/lib/api";
import { attachSource, buildSourceCandidates, type SourceCandidate } from "@/lib/hls";
import { useStore } from "@/lib/store";
import {
  X,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  PictureInPicture2,
  Loader2,
  SkipBack,
  SkipForward,
  RefreshCw,
  MonitorPlay,
  Film,
  ExternalLink,
  RectangleHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PLAYER_ORIGIN = "https://sanjayxrwa2.sanjaykagra2003.workers.dev";

function fmt(t: number): string {
  if (!Number.isFinite(t)) return "0:00";
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function VideoPlayerModal({
  content,
  onClose,
}: {
  content: ApiContent;
  onClose: () => void;
}) {
  // ============ shared state ============
  const mode = useStore((s) => s.playerMode);
  const setMode = useStore((s) => s.setPlayerMode);
  const cinema = useStore((s) => s.playerCinema);
  const setCinema = useStore((s) => s.setPlayerCinema);
  const [fullscreen, setFullscreen] = useState(false);
  const playlist = useStore((s) => s.playerPlaylist);
  const playNext = useStore((s) => s.playNextLecture);
  const playPrev = useStore((s) => s.playPrevLecture);

  const pIdx = playlist.findIndex((p) => p.id === content.id);
  const hasPrev = pIdx > 0;
  const hasNext = pIdx >= 0 && pIdx < playlist.length - 1;

  const shellRef = useRef<HTMLDivElement>(null);

  // ============ fullscreen ============
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      shellRef.current?.requestFullscreen?.().catch(() => undefined);
    } else {
      document.exitFullscreen?.().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // ============ SECURE STREAM (iframe of the dedicated player page) ============
  const [streamSrc, setStreamSrc] = useState<string | null>(null);
  const [streamState, setStreamState] = useState<
    "resolving" | "ready" | "error"
  >("resolving");
  const [streamAttempts, setStreamAttempts] = useState(0);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [iframeLoading, setIframeLoading] = useState(true);

  useEffect(() => {
    setIframeLoading(true);
  }, [iframeKey, mode, streamSrc]);

  /**
   * Resolve a fresh stream link and point the iframe at the dedicated player
   * page (video player ONLY — no site chrome). Retries through busy windows
   * just like the original site's "Servers are busy, retrying…".
   */
  const loadStream = useCallback(
    (round: number, force = false) => {
      setStreamState("resolving");
      setStreamError(null);
      setStreamAttempts(round);
      api
        .resolveVideo(
          content.courseId,
          content.contentId,
          force ? "&force=1" : ""
        )
        .then((r: VideoResolve | null) => {
          const raw = r?.videoUrl || r?.hlsUrl || null;
          const embed = r?.embedUrl || content.embedUrl || null;
          if (raw) {
            setStreamSrc(
              `${PLAYER_ORIGIN}/player?url=${encodeURIComponent(
                raw
              )}&title=${encodeURIComponent(content.title)}`
            );
            setStreamState("ready");
          } else if (embed) {
            setStreamSrc(embed);
            setStreamState("ready");
          } else if (round < 30) {
            window.setTimeout(
              () => loadStreamRef.current(round + 1, force),
              10000
            );
          } else {
            setStreamError("No playable stream found for this lecture.");
            setStreamState("error");
          }
        })
        .catch((e) => {
          const msg = String((e as Error).message || e);
          if (msg.includes("busy") && round < 30) {
            setStreamAttempts(round + 1);
            window.setTimeout(
              () => loadStreamRef.current(round + 1, force),
              10000
            );
          } else {
            setStreamError(msg);
            setStreamState("error");
          }
        });
    },
    [content.courseId, content.contentId, content.title, content.embedUrl]
  );

  const loadStreamRef = useRef<(round: number, force?: boolean) => void>(
    () => undefined
  );
  useEffect(() => {
    loadStreamRef.current = loadStream;
  });

  // kick the stream resolve the first time we are in stream (source) mode
  const streamKickRef = useRef(false);
  useEffect(() => {
    if (mode !== "source" || streamKickRef.current) return;
    streamKickRef.current = true;
    loadStream(0);
  }, [mode, loadStream]);

  /** Gold Reload: force a FRESH link (old ephemeral links expire) + remount iframe */
  const reloadStream = useCallback(() => {
    setIframeKey((k) => k + 1);
    loadStreamRef.current(0, true);
  }, []);

  // ============ NATIVE pipeline (kept from v1, runs only in native mode) ============
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanupRef = useRef<() => void>(() => undefined);
  const candidateIdxRef = useRef(0);
  const resolveRoundRef = useRef(0);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [srcError, setSrcError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [menu, setMenu] = useState<null | "settings">(null);
  const [candidates, setCandidates] = useState<SourceCandidate[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [hasEmittedPlay, setHasEmittedPlay] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const nativeStartedRef = useRef(false);

  const playCandidateRef = useRef<(list: SourceCandidate[], idx: number) => void>(
    () => undefined
  );
  const resolveFreshRef = useRef<(round: number) => void>(() => undefined);

  const resolveFresh = useCallback(
    (round: number) => {
      setResolving(true);
      setResolveError(null);
      setSrcError(null);
      setAttempts(round);
      const force = round > 0 ? "&force=1" : "";
      api
        .resolveVideo(content.courseId, content.contentId, force)
        .then((r: VideoResolve | null) => {
          const list = buildSourceCandidates(
            r
              ? {
                  videoUrl: r.videoUrl,
                  hlsUrl: r.hlsUrl,
                  qualities: r.qualities,
                  embedUrl: r.embedUrl ?? content.embedUrl,
                }
              : null
          );
          if (list.length === 0) {
            setResolving(false);
            if (round < 30) {
              setSrcError("busy"); // keep retrying
              setTimeout(() => resolveFreshRef.current(round + 1), 10000);
            } else {
              setSrcError("No playable stream found for this lecture.");
            }
            return;
          }
          setCandidates(list);
          setResolving(false);
        })
        .catch((e) => {
          const msg = String(e.message || e);
          if (msg.includes("busy") && round < 30) {
            setTimeout(() => resolveFreshRef.current(round + 1), 10000);
          } else {
            setResolveError(msg);
            setResolving(false);
          }
        });
    },
    [content.courseId, content.contentId, content.embedUrl]
  );

  const playCandidate = (list: SourceCandidate[], idx: number) => {
    if (idx >= list.length) {
      if (resolveRoundRef.current < 3) {
        resolveRoundRef.current += 1;
        resolveFreshRef.current(resolveRoundRef.current);
      } else {
        setSrcError(
          "This lecture's direct stream links have expired and the servers are busy refreshing them. Switch back to the Secure stream — it always plays."
        );
      }
      return;
    }
    const v = videoRef.current;
    if (!v) return;
    const c = list[idx];
    if (c.kind === "embed") {
      setSrcError("embed");
      return;
    }
    cleanupRef.current?.();
    candidateIdxRef.current = idx;
    setActiveIdx(idx);
    setSrcError(null);
    cleanupRef.current = attachSource(v, c.url, () => {
      playCandidateRef.current(list, idx + 1);
    });
    v.load();
    v.play().catch(() => undefined);
  };

  useEffect(() => {
    playCandidateRef.current = playCandidate;
    resolveFreshRef.current = resolveFresh;
  });

  // kick the native pipeline the first time the user switches to NATIVE mode
  useEffect(() => {
    if (mode !== "native") return;
    if (nativeStartedRef.current) return;
    nativeStartedRef.current = true;
    resolveRoundRef.current = 0;
    resolveFresh(0);
  }, [mode, resolveFresh]);

  // (re)attach candidates once <video> mounts in native mode
  useEffect(() => {
    if (mode !== "native") return;
    if (!resolving && candidates.length > 0 && !srcError) {
      playCandidateRef.current(candidates, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, resolving, mode]);

  // cleanup native pipeline when leaving native mode or unmounting
  useEffect(() => {
    if (mode !== "native") {
      cleanupRef.current?.();
      cleanupRef.current = () => undefined;
    }
  }, [mode]);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  // keyboard shortcuts (parent-level; the iframe swallows keys when focused)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) {
        onClose();
        return;
      }
      if (mode !== "native") return;
      const v = videoRef.current;
      if (!v) return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          if (v.paused) v.play().catch(() => undefined);
          else v.pause();
          break;
        case "ArrowRight":
          v.currentTime = Math.min(v.currentTime + 10, v.duration || 0);
          break;
        case "ArrowLeft":
          v.currentTime = Math.max(v.currentTime - 10, 0);
          break;
        case "ArrowUp":
          e.preventDefault();
          v.volume = Math.min(v.volume + 0.1, 1);
          break;
        case "ArrowDown":
          e.preventDefault();
          v.volume = Math.max(v.volume - 0.1, 0);
          break;
        case "m":
          v.muted = !v.muted;
          break;
        case "f":
          toggleFullscreen();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, mode, toggleFullscreen]);

  const nudgeControls = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setShowControls(false);
    }, 2800);
  }, []);

  const mp4Qualities = candidates.filter((c) => c.kind === "mp4");
  const activeLabel = candidates[activeIdx]?.label ?? "Auto";

  const pickQuality = (c: SourceCandidate | null) => {
    setMenu(null);
    const v = videoRef.current;
    if (!v) return;
    const time = v.currentTime;
    const wasPlaying = !v.paused || hasEmittedPlay;
    if (c) {
      playCandidate(candidates, candidates.indexOf(c));
    } else {
      playCandidate(candidates, 0);
    }
    if (wasPlaying) {
      v.addEventListener(
        "loadedmetadata",
        () => {
          v.currentTime = time;
        },
        { once: true }
      );
    }
  };

  const isBusy = srcError === "busy";

  // ============ tiny reusable golden icon button ============
  const GoldIcon = ({
    icon: Icon,
    label,
    onClick,
    disabled,
    active,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    onClick?: () => void;
    disabled?: boolean;
    active?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "group/ib relative h-10 w-10 rounded-xl flex items-center justify-center transition-all duration-200",
        "border border-[rgba(230,194,110,0.22)] bg-white/5 backdrop-blur-md",
        "hover:bg-[rgba(230,194,110,0.16)] hover:border-[rgba(230,194,110,0.55)] hover:shadow-[0_0_18px_rgba(230,194,110,0.25)]",
        "disabled:opacity-30 disabled:pointer-events-none",
        active && "bg-[rgba(230,194,110,0.22)] border-[rgba(230,194,110,0.65)] text-[#f2d98a]"
      )}
    >
      <Icon className={cn("h-[18px] w-[18px] transition-colors", active ? "text-[#f2d98a]" : "text-[#e6c26e] group-hover/ib:text-[#f2d98a]")} />
    </button>
  );

  return (
    <div className="fixed inset-0 z-[80] bg-black/97 backdrop-blur-md flex flex-col theater-root">
      {/* ================= header ================= */}
      <div className="shrink-0 relative z-20 border-b border-[rgba(230,194,110,0.18)] bg-gradient-to-r from-black/80 via-[#141005]/80 to-black/80">
        <div className="flex items-center gap-3 px-3 sm:px-4 h-14">
          <div className="h-9 w-9 rounded-xl btn-gold flex items-center justify-center shrink-0 shadow-[0_0_18px_rgba(230,194,110,0.35)]">
            <Film className="h-5 w-5 text-[#241a04]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white truncate leading-tight">
              {content.title}
            </p>
            <p className="text-[11px] text-[#e6c26e]/70 leading-tight flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#e6c26e] animate-pulse" />
              Golden Theater · Lecture {pIdx >= 0 ? pIdx + 1 : 1}
              {playlist.length > 1 ? ` of ${playlist.length}` : ""}
            </p>
          </div>

          {/* mode badge */}
          <div
            className={cn(
              "hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-full text-[10px] font-extrabold tracking-[0.14em] uppercase",
              mode === "source"
                ? "bg-[rgba(230,194,110,0.14)] text-[#f2d98a] border border-[rgba(230,194,110,0.4)]"
                : "bg-white/5 text-white/70 border border-white/15"
            )}
          >
            {mode === "source" ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-[#e6c26e] animate-pulse" />
                Secure stream
              </>
            ) : (
              <>
                <MonitorPlay className="h-3.5 w-3.5" />
                Native player
              </>
            )}
          </div>

          <button
            onClick={() => {
              if (document.fullscreenElement) {
                document.exitFullscreen?.().catch(() => undefined);
              }
              onClose();
            }}
            aria-label="Close player"
            className="h-9 w-9 rounded-xl flex items-center justify-center text-white/80 hover:text-white border border-white/15 bg-white/5 hover:bg-white/15 transition-colors"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>
        {/* golden hairline glow under header */}
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[rgba(230,194,110,0.65)] to-transparent" />
      </div>

      {/* ================= stage ================= */}
      <div
        ref={shellRef}
        className="flex-1 relative flex items-center justify-center overflow-hidden bg-black min-h-0"
        onMouseMove={mode === "native" ? nudgeControls : undefined}
        onTouchStart={mode === "native" ? nudgeControls : undefined}
      >
        {/* golden ambient glow */}
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute -top-24 left-1/4 h-72 w-72 rounded-full bg-[rgba(230,194,110,0.10)] blur-3xl" />
          <div className="absolute -bottom-24 right-1/5 h-72 w-72 rounded-full bg-[rgba(184,134,11,0.09)] blur-3xl" />
        </div>

        {/* ---------- SECURE STREAM MODE (video player only) ---------- */}
        {mode === "source" ? (
          <div
            className={cn(
              "relative",
              cinema
                ? "w-full max-w-[1500px] aspect-video rounded-2xl overflow-hidden gold-border-glow"
                : "w-full h-full"
            )}
          >
            {streamState === "ready" && streamSrc ? (
              <iframe
                key={iframeKey}
                src={streamSrc}
                title={`Lecture player: ${content.title}`}
                className="absolute inset-0 w-full h-full border-0 bg-black"
                referrerPolicy="no-referrer"
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture; clipboard-write"
                allowFullScreen
                onLoad={() => setIframeLoading(false)}
              />
            ) : null}

            {/* resolving / busy overlay */}
            {streamState === "resolving" ? (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black px-6 text-center">
                <div className="relative">
                  <div className="absolute -inset-6 rounded-full bg-[rgba(230,194,110,0.14)] blur-2xl" />
                  <Loader2 className="relative h-12 w-12 text-[#e6c26e] animate-spin" />
                </div>
                <p className="text-sm font-semibold gold-text tracking-wide">
                  {streamAttempts > 0
                    ? `Servers are busy, retrying… (attempt ${streamAttempts + 1})`
                    : "Preparing your lecture…"}
                </p>
                <p className="text-xs text-white/40">
                  Resolving a fresh secure stream link
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => loadStreamRef.current(0, true)}
                    className="rounded-xl px-4 py-2 text-sm font-bold border border-[rgba(230,194,110,0.4)] text-[#e6c26e] hover:bg-[rgba(230,194,110,0.12)] transition-colors"
                  >
                    Retry now
                  </button>
                  <button
                    onClick={() => setMode("native")}
                    className="text-xs text-[#e6c26e] underline underline-offset-4 hover:text-[#f2d98a]"
                  >
                    Try the native player instead
                  </button>
                </div>
              </div>
            ) : streamState === "error" ? (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black px-6 text-center">
                <p className="text-white/80 text-sm max-w-md">{streamError}</p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => loadStreamRef.current(0, true)}
                    className="btn-gold rounded-xl px-4 py-2 text-sm font-bold"
                  >
                    Try again
                  </button>
                  <button
                    onClick={() => setMode("native")}
                    className="rounded-xl px-4 py-2 text-sm font-bold border border-[rgba(230,194,110,0.4)] text-[#e6c26e] hover:bg-[rgba(230,194,110,0.12)] transition-colors"
                  >
                    Use Native player
                  </button>
                </div>
              </div>
            ) : iframeLoading ? (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black">
                <div className="relative">
                  <div className="absolute -inset-6 rounded-full bg-[rgba(230,194,110,0.14)] blur-2xl" />
                  <Loader2 className="relative h-12 w-12 text-[#e6c26e] animate-spin" />
                </div>
                <p className="text-sm font-semibold gold-text tracking-wide">
                  Connecting to the secure player…
                </p>
                <p className="text-xs text-white/40">
                  Golden Theater · streaming from the source
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          /* ---------- NATIVE MODE ---------- */
          <>
            {resolving || isBusy ? (
              <div className="flex flex-col items-center gap-4 px-6 text-center">
                <Loader2 className="h-10 w-10 text-[#e6c26e] animate-spin" />
                <p className="text-sm text-white/70">
                  {isBusy
                    ? `Servers are busy, retrying…${attempts > 0 ? ` (attempt ${attempts + 1})` : ""}`
                    : "Preparing your lecture…"}
                </p>
                <button
                  onClick={() => setMode("source")}
                  className="text-xs text-[#e6c26e] underline underline-offset-4 hover:text-[#f2d98a]"
                >
                  Play via Secure stream instead — always works
                </button>
              </div>
            ) : resolveError ? (
              <div className="text-center px-6">
                <p className="text-red-300 text-sm mb-3">
                  Could not load this lecture: {resolveError}
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => {
                      resolveRoundRef.current = 0;
                      resolveFresh(0);
                    }}
                    className="btn-gold rounded-xl px-4 py-2 text-sm font-bold"
                  >
                    Retry
                  </button>
                  <button
                    onClick={() => setMode("source")}
                    className="rounded-xl px-4 py-2 text-sm font-bold border border-[rgba(230,194,110,0.4)] text-[#e6c26e] hover:bg-[rgba(230,194,110,0.12)]"
                  >
                    Use Secure stream
                  </button>
                </div>
              </div>
            ) : srcError && srcError !== "embed" && srcError !== "busy" ? (
              <div className="text-center px-6 max-w-md">
                <p className="text-white/80 text-sm mb-4">{srcError}</p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => {
                      resolveRoundRef.current = 0;
                      resolveFresh(0);
                    }}
                    className="btn-gold rounded-xl px-4 py-2 text-sm font-bold"
                  >
                    Try again
                  </button>
                  <button
                    onClick={() => setMode("source")}
                    className="rounded-xl px-4 py-2 text-sm font-bold border border-[rgba(230,194,110,0.4)] text-[#e6c26e] hover:bg-[rgba(230,194,110,0.12)]"
                  >
                    Use Secure stream
                  </button>
                </div>
              </div>
            ) : srcError === "embed" && content.embedUrl ? (
              <iframe
                src={content.embedUrl}
                title={content.title}
                className="w-full h-full border-0"
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video
                ref={videoRef}
                poster={content.thumbnail ?? undefined}
                controls={false}
                playsInline
                preload="auto"
                className={cn(
                  "w-full outline-none",
                  fullscreen ? "h-full object-contain" : "max-h-full"
                )}
                onClick={() => {
                  const v = videoRef.current;
                  if (v) {
                    if (v.paused) v.play().catch(() => undefined);
                    else v.pause();
                  }
                  nudgeControls();
                }}
                onPlay={() => {
                  setPlaying(true);
                  setHasEmittedPlay(true);
                  nudgeControls();
                }}
                onPause={() => {
                  setPlaying(false);
                  setShowControls(true);
                }}
                onWaiting={() => nudgeControls()}
                onTimeUpdate={(e) => {
                  const v = e.currentTarget;
                  setCurrent(v.currentTime);
                  if (v.buffered.length > 0)
                    setBuffered(v.buffered.end(v.buffered.length - 1));
                }}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                onVolumeChange={(e) => {
                  setVolume(e.currentTarget.volume);
                  setMuted(e.currentTarget.muted);
                }}
              />
            )}

            {/* center play button */}
            {!resolving && !isBusy && !resolveError && !playing && !srcError ? (
              <button
                onClick={() => videoRef.current?.play()}
                aria-label="Play"
                className="absolute inset-0 m-auto h-20 w-20 rounded-full glass gold-border-glow flex items-center justify-center text-[#e6c26e] hover:scale-105 transition-transform"
              >
                <Play className="h-9 w-9 fill-current" />
              </button>
            ) : null}

            {/* native control bar */}
            {!resolving && !isBusy && !resolveError && !srcError ? (
              <div
                className={cn(
                  "absolute bottom-0 inset-x-0 transition-all duration-300",
                  showControls
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-3 pointer-events-none"
                )}
              >
                <div className="mx-3 mb-3 rounded-2xl glass glass-sheen px-4 py-3">
                  {/* seek bar */}
                  <div className="relative flex items-center gap-3">
                    <input
                      type="range"
                      className="player-range w-full"
                      min={0}
                      max={duration || 0}
                      step={0.1}
                      value={current}
                      aria-label="Seek"
                      style={{
                        background: `linear-gradient(to right, #e6c26e 0%, #e6c26e ${
                          duration ? (current / duration) * 100 : 0
                        }%, rgba(230,194,110,0.35) ${
                          duration ? (buffered / duration) * 100 : 0
                        }%, rgba(255,255,255,0.18) ${
                          duration ? (buffered / duration) * 100 : 0
                        }%, rgba(255,255,255,0.18) 100%)`,
                      }}
                      onChange={(e) => {
                        const v = videoRef.current;
                        if (v) v.currentTime = Number(e.target.value);
                      }}
                    />
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2.5 mt-2.5 text-white/90">
                    <button
                      onClick={playPrev}
                      disabled={!hasPrev}
                      aria-label="Previous lecture"
                      className="p-2 rounded-full hover:bg-white/10 disabled:opacity-30"
                    >
                      <SkipBack className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => {
                        const v = videoRef.current;
                        if (v) {
                          if (v.paused) v.play().catch(() => undefined);
                          else v.pause();
                        }
                      }}
                      aria-label={playing ? "Pause" : "Play"}
                      className="p-2 rounded-full hover:bg-white/10"
                    >
                      {playing ? (
                        <Pause className="h-5 w-5" />
                      ) : (
                        <Play className="h-5 w-5 fill-current" />
                      )}
                    </button>
                    <button
                      onClick={playNext}
                      disabled={!hasNext}
                      aria-label="Next lecture"
                      className="p-2 rounded-full hover:bg-white/10 disabled:opacity-30"
                    >
                      <SkipForward className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => {
                        const v = videoRef.current;
                        if (v) v.currentTime = Math.max(0, v.currentTime - 10);
                      }}
                      aria-label="Back 10 seconds"
                      className="p-2 rounded-full hover:bg-white/10"
                    >
                      <RotateCcw className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => {
                        const v = videoRef.current;
                        if (v)
                          v.currentTime = Math.min(
                            v.currentTime + 10,
                            v.duration || 0
                          );
                      }}
                      aria-label="Forward 10 seconds"
                      className="p-2 rounded-full hover:bg-white/10"
                    >
                      <RotateCw className="h-5 w-5" />
                    </button>

                    <div className="flex items-center gap-1.5 group/vol">
                      <button
                        onClick={() => {
                          const v = videoRef.current;
                          if (v) v.muted = !v.muted;
                        }}
                        aria-label={muted ? "Unmute" : "Mute"}
                        className="p-2 rounded-full hover:bg-white/10"
                      >
                        {muted || volume === 0 ? (
                          <VolumeX className="h-5 w-5" />
                        ) : (
                          <Volume2 className="h-5 w-5" />
                        )}
                      </button>
                      <input
                        type="range"
                        className="player-range w-0 group-hover/vol:w-16 sm:w-16 transition-all duration-300"
                        min={0}
                        max={1}
                        step={0.05}
                        value={muted ? 0 : volume}
                        aria-label="Volume"
                        onChange={(e) => {
                          const v = videoRef.current;
                          if (v) {
                            v.volume = Number(e.target.value);
                            v.muted = Number(e.target.value) === 0;
                          }
                        }}
                      />
                    </div>

                    <span className="text-xs tabular-nums ml-1">
                      {fmt(current)} / {fmt(duration)}
                    </span>

                    <div className="flex-1" />

                    {/* switch to secure stream */}
                    <button
                      onClick={() => setMode("source")}
                      aria-label="Switch to secure stream"
                      title="Switch to the Secure stream — always plays"
                      className="p-2 rounded-full hover:bg-[rgba(230,194,110,0.15)] text-[#e6c26e]"
                    >
                      <Film className="h-5 w-5" />
                    </button>

                    {/* settings */}
                    <div className="relative">
                      <button
                        onClick={() => setMenu(menu === null ? "settings" : null)}
                        aria-label="Settings"
                        className={cn(
                          "p-2 rounded-full hover:bg-white/10",
                          menu ? "text-[#e6c26e]" : ""
                        )}
                      >
                        <Settings className="h-5 w-5" />
                      </button>
                      {menu === "settings" ? (
                        <div className="absolute bottom-12 right-0 rounded-2xl glass glass-sheen p-2 min-w-[160px] text-sm max-h-64 overflow-y-auto">
                          <p className="px-2 py-1 text-[10px] font-bold tracking-widest text-muted-foreground">
                            QUALITY
                          </p>
                          {mp4Qualities.length > 0 ? (
                            mp4Qualities.map((c) => (
                              <button
                                key={c.url}
                                onClick={() => pickQuality(c)}
                                className={cn(
                                  "w-full text-left px-3 py-1.5 rounded-lg hover:bg-white/10",
                                  activeLabel === c.label &&
                                    "text-[#e6c26e] font-bold"
                                )}
                              >
                                {c.label}
                              </button>
                            ))
                          ) : (
                            <p className="px-3 py-1.5 text-xs text-muted-foreground">
                              Auto ({activeLabel})
                            </p>
                          )}
                          <p className="px-2 pt-1 text-[10px] font-bold tracking-widest text-muted-foreground">
                            SPEED
                          </p>
                          <div className="grid grid-cols-3 gap-1 px-1 pb-1">
                            {SPEEDS.map((s) => (
                              <button
                                key={s}
                                onClick={() => {
                                  setSpeed(s);
                                  if (videoRef.current)
                                    videoRef.current.playbackRate = s;
                                }}
                                className={cn(
                                  "px-2 py-1 rounded-lg text-xs hover:bg-white/10",
                                  speed === s &&
                                    "text-[#e6c26e] font-bold bg-white/5"
                                )}
                              >
                                {s}x
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <button
                      onClick={() => {
                        const v = videoRef.current as
                          | (HTMLVideoElement & {
                              requestPictureInPicture?: () => Promise<unknown>;
                            })
                          | null;
                        v?.requestPictureInPicture?.().catch(() => undefined);
                      }}
                      aria-label="Picture in picture"
                      className="p-2 rounded-full hover:bg-white/10 hidden sm:block"
                    >
                      <PictureInPicture2 className="h-5 w-5" />
                    </button>
                    <button
                      onClick={toggleFullscreen}
                      aria-label="Fullscreen"
                      className="p-2 rounded-full hover:bg-white/10"
                    >
                      {fullscreen ? (
                        <Minimize className="h-5 w-5" />
                      ) : (
                        <Maximize className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}

        {/* floating prev / next (both modes) */}
        {mode === "source" && (hasPrev || hasNext) ? (
          <>
            <button
              onClick={playPrev}
              disabled={!hasPrev}
              aria-label="Previous lecture"
              className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 z-10 h-11 w-11 items-center justify-center rounded-full glass gold-border-glow text-[#e6c26e] hover:scale-105 hover:text-[#f2d98a] transition-all disabled:opacity-25 disabled:pointer-events-none"
            >
              <SkipBack className="h-5 w-5 fill-current" />
            </button>
            <button
              onClick={playNext}
              disabled={!hasNext}
              aria-label="Next lecture"
              className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 z-10 h-11 w-11 items-center justify-center rounded-full glass gold-border-glow text-[#e6c26e] hover:scale-105 hover:text-[#f2d98a] transition-all disabled:opacity-25 disabled:pointer-events-none"
            >
              <SkipForward className="h-5 w-5 fill-current" />
            </button>
          </>
        ) : null}
      </div>

      {/* ================= golden dock (source mode) ================= */}
      {mode === "source" ? (
        <div className="shrink-0 relative z-20 border-t border-[rgba(230,194,110,0.16)] bg-black/85">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[rgba(230,194,110,0.55)] to-transparent" />
          <div className="flex items-center gap-2 px-3 sm:px-5 py-2.5 overflow-x-auto">
            <GoldIcon
              icon={SkipBack}
              label="Previous lecture"
              onClick={playPrev}
              disabled={!hasPrev}
            />
            <GoldIcon
              icon={SkipForward}
              label="Next lecture"
              onClick={playNext}
              disabled={!hasNext}
            />
            <div className="h-6 w-px bg-[rgba(230,194,110,0.2)] mx-1 shrink-0" />
            <GoldIcon
              icon={RefreshCw}
              label="Reload with a fresh secure link"
              onClick={reloadStream}
            />
            <GoldIcon
              icon={MonitorPlay}
              label="Try the native player"
              onClick={() => setMode("native")}
            />
            <GoldIcon
              icon={RectangleHorizontal}
              label={cinema ? "Exit cinema frame" : "Cinema frame"}
              onClick={() => setCinema((c) => !c)}
              active={cinema}
            />
            <div className="flex-1 min-w-2" />
            <GoldIcon
              icon={ExternalLink}
              label="Open player in new tab"
              disabled={!streamSrc}
              onClick={() =>
                streamSrc ? window.open(streamSrc, "_blank", "noopener") : undefined
              }
            />
            <GoldIcon
              icon={Maximize}
              label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              onClick={toggleFullscreen}
            />
            <span className="hidden md:block text-[10px] tracking-[0.18em] uppercase text-[#e6c26e]/50 font-bold pl-1 shrink-0">
              Study Bison Golden Theater
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
