"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { api, type ApiTopic, type ApiContent } from "@/lib/api";
import { BackHeader, EmptyState, ErrorState, Loader } from "./common";
import {
  ChevronRight,
  FolderKanban,
  PlayCircle,
  FileText,
  Package,
  Bookmark,
  Share2,
  BookmarkCheck,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function TopicsView({
  batchId,
  subjectId,
  subjectName,
  onBack,
}: {
  batchId: string;
  subjectId: string;
  subjectName?: string;
  onBack: () => void;
}) {
  const push = useStore((s) => s.push);
  const [topics, setTopics] = useState<ApiTopic[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    api
      .topics(batchId, subjectId)
      .then((d) => {
        if (alive) setTopics(d);
      })
      .catch((e) => {
        if (alive) setError(String(e.message || e));
      });
    return () => {
      alive = false;
    };
  }, [batchId, subjectId, reload]);

  return (
    <div>
      <BackHeader
        title={subjectName ?? "Topics"}
        subtitle={topics ? `${topics.length} topics found` : undefined}
        onBack={onBack}
      />
      <div className="px-4 sm:px-6 py-5 pb-10">
        {error ? (
          <ErrorState
            message={`Could not load topics: ${error}`}
            onRetry={() => {
              setError(null);
              setReload((r) => r + 1);
            }}
          />
        ) : topics === null ? (
          <Loader label="Loading topics…" />
        ) : topics.length === 0 ? (
          <EmptyState
            icon={<FolderKanban className="h-8 w-8" />}
            title="No topics found"
            hint="This subject has no topics yet."
          />
        ) : (
          <div className="space-y-3 max-w-3xl">
            {topics.map((t) => (
              <button
                key={t.topicId}
                onClick={() =>
                  push({
                    type: "topic",
                    batchId,
                    subjectId,
                    topicId: t.topicId,
                    title: t.topicName,
                  })
                }
                className="glass glass-sheen glass-hover rounded-2xl p-4 w-full flex items-center gap-4 text-left group"
              >
                <div className="h-11 w-11 rounded-xl bg-black/40 border border-border flex items-center justify-center overflow-hidden shrink-0">
                  {t.topicLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.topicLogo} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <FolderKanban className="h-5 w-5 text-[#e6c26e]" />
                  )}
                </div>
                <p className="flex-1 text-sm sm:text-base font-bold leading-snug">
                  {t.topicName}
                </p>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-[#e6c26e] group-hover:translate-x-1 transition-all" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="glass glass-sheen rounded-2xl py-4 flex flex-col items-center gap-1">
      <span className="text-[#e6c26e]">{icon}</span>
      <span className="text-2xl font-extrabold gold-text">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function TopicView({
  batchId,
  subjectId,
  topicId,
  topicName,
  onBack,
}: {
  batchId: string;
  subjectId: string;
  topicId: string;
  topicName?: string;
  onBack: () => void;
}) {
  const [items, setItems] = useState<ApiContent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<"videos" | "pdfs">("videos");
  const openPlayer = useStore((s) => s.openPlayer);
  const openPdf = useStore((s) => s.openPdf);
  const saved = useStore((s) => s.saved);
  const toggleSaved = useStore((s) => s.toggleSaved);

  useEffect(() => {
    let alive = true;
    api
      .content(batchId, subjectId, topicId)
      .then((d) => {
        if (alive) setItems(d);
      })
      .catch((e) => {
        if (alive) setError(String(e.message || e));
      });
    return () => {
      alive = false;
    };
  }, [batchId, subjectId, topicId, reload]);

  const videos = (items ?? []).filter((i) => i.materialType === "VIDEO");
  const pdfs = (items ?? []).filter((i) => i.materialType === "PDF");
  const others = (items ?? []).filter(
    (i) => i.materialType !== "VIDEO" && i.materialType !== "PDF"
  );
  const shown = tab === "videos" ? videos : pdfs;

  return (
    <div>
      <BackHeader
        title={topicName ?? "Content"}
        subtitle={
          items
            ? `${videos.length} videos · ${pdfs.length} PDFs`
            : undefined
        }
        onBack={onBack}
      />
      <div className="px-4 sm:px-6 py-5 pb-10">
        {error ? (
          <ErrorState
            message={`Could not load content: ${error}`}
            onRetry={() => {
              setError(null);
              setReload((r) => r + 1);
            }}
          />
        ) : items === null ? (
          <Loader label="Loading content…" />
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 max-w-2xl">
              <StatCard icon={<PlayCircle className="h-5 w-5" />} value={videos.length} label="Videos" />
              <StatCard icon={<FileText className="h-5 w-5" />} value={pdfs.length} label="PDFs" />
              <StatCard icon={<Package className="h-5 w-5" />} value={others.length} label="Other" />
            </div>

            {/* Tabs */}
            <div className="mt-5 border-b border-border/60 flex gap-6">
              <button
                onClick={() => setTab("videos")}
                className={`pb-2.5 text-sm font-bold flex items-center gap-2 border-b-2 -mb-px transition-colors ${
                  tab === "videos"
                    ? "text-[#e6c26e] border-[#e6c26e]"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                <PlayCircle className="h-4 w-4" />
                Videos ({videos.length})
              </button>
              <button
                onClick={() => setTab("pdfs")}
                className={`pb-2.5 text-sm font-bold flex items-center gap-2 border-b-2 -mb-px transition-colors ${
                  tab === "pdfs"
                    ? "text-[#e6c26e] border-[#e6c26e]"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                <FileText className="h-4 w-4" />
                PDFs ({pdfs.length})
              </button>
            </div>

            {/* Items */}
            <div className="mt-4 space-y-3 max-w-3xl">
              {shown.length === 0 ? (
                <EmptyState
                  icon={
                    tab === "videos" ? (
                      <PlayCircle className="h-8 w-8" />
                    ) : (
                      <FileText className="h-8 w-8" />
                    )
                  }
                  title={tab === "videos" ? "No videos here" : "No PDFs here"}
                  hint="Content will appear here once published."
                />
              ) : (
                shown.map((item) => {
                  const isSaved = Boolean(saved[item.id]);
                  return (
                    <div
                      key={item.id}
                      className="glass glass-sheen glass-hover rounded-2xl p-3 flex items-center gap-3 group"
                    >
                      <button
                        onClick={() =>
                          item.materialType === "VIDEO"
                            ? openPlayer(item, videos)
                            : openPdf(item)
                        }
                        className="h-14 w-24 rounded-xl bg-black/40 border border-border overflow-hidden shrink-0 relative"
                        aria-label={`Open ${item.title}`}
                      >
                        {item.thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.thumbnail}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            {item.materialType === "VIDEO" ? (
                              <PlayCircle className="h-6 w-6 text-[#e6c26e]" />
                            ) : (
                              <FileText className="h-6 w-6 text-[#e6c26e]" />
                            )}
                          </div>
                        )}
                        {item.materialType === "VIDEO" ? (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity">
                            <PlayCircle className="h-7 w-7 text-white" />
                          </span>
                        ) : null}
                      </button>
                      <button
                        onClick={() =>
                          item.materialType === "VIDEO"
                            ? openPlayer(item, videos)
                            : openPdf(item)
                        }
                        className="flex-1 min-w-0 text-left"
                      >
                        <p className="text-sm font-bold line-clamp-2 leading-snug group-hover:text-accent-foreground transition-colors">
                          {item.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {item.materialType === "VIDEO" ? "VIDEO" : "PDF"}
                          {item.dateAndTime ? ` · ${item.dateAndTime}` : ""}
                        </p>
                      </button>
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => {
                            toggleSaved(item);
                            toast({
                              title: isSaved ? "Removed from Saved" : "Saved for later",
                              description: item.title,
                            });
                          }}
                          aria-label={isSaved ? "Remove bookmark" : "Bookmark"}
                          className="p-2 rounded-full hover:bg-accent text-muted-foreground hover:text-[#e6c26e] transition-colors"
                        >
                          {isSaved ? (
                            <BookmarkCheck className="h-4 w-4 text-[#e6c26e]" />
                          ) : (
                            <Bookmark className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={async () => {
                            const url = `${window.location.origin}/?item=${item.id}`;
                            try {
                              if (navigator.share) {
                                await navigator.share({ title: item.title, url });
                              } else {
                                await navigator.clipboard.writeText(url);
                                toast({ title: "Link copied", description: item.title });
                              }
                            } catch {
                              /* cancelled */
                            }
                          }}
                          aria-label="Share"
                          className="p-2 rounded-full hover:bg-accent text-muted-foreground hover:text-[#e6c26e] transition-colors"
                        >
                          <Share2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
