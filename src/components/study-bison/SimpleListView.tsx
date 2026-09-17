"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { api, formatPrice, isBatchNew, type ApiBatch, type ApiContent } from "@/lib/api";
import { BatchCard } from "./BatchCard";
import { BackHeader, EmptyState, Loader } from "./common";
import { Star, Clock, Bookmark, ClipboardList, Sparkles, Archive } from "lucide-react";

export function SimpleListView({
  type,
  onBack,
}: {
  type: "favorites" | "recent" | "saved" | "attempts" | "new" | "old";
  onBack: () => void;
}) {
  const favorites = useStore((s) => s.favorites);
  const recents = useStore((s) => s.recents);
  const saved = useStore((s) => s.saved);
  const [batches, setBatches] = useState<ApiBatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const needsBatches = type === "new" || type === "old";

  const meta = {
    favorites: { title: "Favorites", icon: Star, empty: "No favorites yet", hint: "Tap the heart on any batch to keep it here." },
    recent: { title: "Recent", icon: Clock, empty: "Nothing here yet", hint: "Batches you open will show up here." },
    saved: { title: "Saved", icon: Bookmark, empty: "No saved items", hint: "Bookmark lectures and notes to find them fast." },
    attempts: { title: "My Attempts", icon: ClipboardList, empty: "No attempts yet", hint: "Your quiz and test attempts will appear here." },
    new: { title: "New Batch", icon: Sparkles, empty: "No new batches", hint: "Batches launched in the last 30 days appear here." },
    old: { title: "Old Batch", icon: Archive, empty: "No batches", hint: "Everything else lands here." },
  }[type];

  const savedList = useMemo(() => Object.values(saved) as ApiContent[], [saved]);

  useEffect(() => {
    if (!needsBatches) return;
    let alive = true;
    api
      .batches()
      .then((d) => {
        if (alive) setBatches(d);
      })
      .catch((e) => {
        if (alive) setError(String(e.message || e));
      });
    return () => {
      alive = false;
    };
  }, [needsBatches]);

  let content: React.ReactNode = null;
  if (type === "favorites") {
    const list = Object.values(favorites) as ApiBatch[];
    content =
      list.length === 0 ? (
        <Empty icon={meta.icon} title={meta.empty} hint={meta.hint} />
      ) : (
        <Grid batches={list} />
      );
  } else if (type === "recent") {
    content =
      recents.length === 0 ? (
        <Empty icon={meta.icon} title={meta.empty} hint={meta.hint} />
      ) : (
        <Grid batches={recents} />
      );
  } else if (type === "new" || type === "old") {
    if (error) content = <Empty icon={meta.icon} title="Could not load" hint={error} />;
    else if (batches === null) content = <Loader label="Loading batches…" />;
    else {
      const list = batches.filter((b) => (type === "new" ? isBatchNew(b) : !isBatchNew(b)));
      content =
        list.length === 0 ? (
          <Empty icon={meta.icon} title={meta.empty} hint={meta.hint} />
        ) : (
          <Grid batches={list} />
        );
    }
  } else if (type === "saved") {
    content =
      savedList.length === 0 ? (
        <Empty icon={meta.icon} title={meta.empty} hint={meta.hint} />
      ) : (
        <div className="space-y-3 max-w-3xl">
          {savedList.map((item) => (
            <div key={item.id} className="glass glass-sheen rounded-2xl p-3 flex items-center gap-3">
              <div className="h-12 w-20 rounded-xl bg-black/40 border border-border overflow-hidden shrink-0 flex items-center justify-center">
                {item.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold line-clamp-2">{item.title}</p>
                <p className="text-[11px] text-muted-foreground">{item.materialType}</p>
              </div>
            </div>
          ))}
        </div>
      );
  } else {
    content = <Empty icon={meta.icon} title={meta.empty} hint={meta.hint} />;
  }

  const Icon = meta.icon;

  return (
    <div>
      <BackHeader title={meta.title} onBack={onBack} />
      <div className="px-4 sm:px-6 py-5 pb-10">{content}</div>
    </div>
  );
}

function Empty({
  icon: Icon,
  title,
  hint,
}: {
  icon: React.ElementType;
  title: string;
  hint: string;
}) {
  return (
    <EmptyState
      icon={<Icon className="h-8 w-8" />}
      title={title}
      hint={hint}
    />
  );
}

function Grid({ batches }: { batches: ApiBatch[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {batches.map((b) => (
        <BatchCard key={b.batchId} batch={b} />
      ))}
    </div>
  );
}
