"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { api, isBatchNew, type ApiBatch } from "@/lib/api";
import { BatchCard } from "./BatchCard";
import { Chip, EmptyState, ErrorState, Loader } from "./common";
import { SearchX, PackageOpen } from "lucide-react";

function Grid({ batches }: { batches: ApiBatch[] }) {
  if (batches.length === 0)
    return (
      <EmptyState
        icon={<SearchX className="h-8 w-8" />}
        title="No batches found"
        hint="Try a different search or filter."
      />
    );
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {batches.map((b) => (
        <BatchCard key={b.batchId} batch={b} />
      ))}
    </div>
  );
}

export function DashboardView() {
  const [batches, setBatches] = useState<ApiBatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const search = useStore((s) => s.search);
  const setSearch = useStore((s) => s.setSearch);
  const filter = useStore((s) => s.filter);
  const setFilter = useStore((s) => s.setFilter);
  const favorites = useStore((s) => s.favorites);

  useEffect(() => {
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
  }, [reload]);

  const counts = useMemo(() => {
    const all = batches ?? [];
    const newCount = all.filter((b) => isBatchNew(b)).length;
    return { all: all.length, new: newCount, old: all.length - newCount };
  }, [batches]);

  const shown = useMemo(() => {
    let list = batches ?? [];
    if (filter === "new") list = list.filter((b) => isBatchNew(b));
    if (filter === "old") list = list.filter((b) => !isBatchNew(b));
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((b) => b.batchName.toLowerCase().includes(q));
    return list;
  }, [batches, filter, search]);

  if (error)
    return (
      <ErrorState
        message={`Could not load batches: ${error}`}
        onRetry={() => {
          setError(null);
          setReload((r) => r + 1);
        }}
      />
    );

  return (
    <div className="px-4 sm:px-6 pb-10">
      {/* Search */}
      <div className="glass glass-sheen rounded-2xl mt-4 flex items-center gap-3 px-4 py-3">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-muted-foreground shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search batches..."
          aria-label="Search batches"
          className="bg-transparent outline-none w-full text-sm placeholder:text-muted-foreground/70"
        />
        {search ? (
          <button
            onClick={() => setSearch("")}
            aria-label="Clear search"
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            ✕
          </button>
        ) : null}
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>
          All ({counts.all})
        </Chip>
        <Chip active={filter === "new"} onClick={() => setFilter("new")}>
          New ({counts.new})
        </Chip>
        <Chip active={filter === "old"} onClick={() => setFilter("old")}>
          Old ({counts.old})
        </Chip>
      </div>

      {/* Batch grid */}
      <div className="mt-5">
        {batches === null ? <Loader label="Loading batches…" /> : <Grid batches={shown} />}
      </div>
    </div>
  );
}

export function FavoritesView() {
  const favorites = useStore((s) => s.favorites);
  const list = Object.values(favorites) as ApiBatch[];
  if (list.length === 0)
    return (
      <EmptyState
        icon={<PackageOpen className="h-8 w-8" />}
        title="No favorites yet"
        hint="Tap the heart on any batch to keep it here."
      />
    );
  return (
    <div className="p-4 sm:p-6">
      <Grid batches={list} />
    </div>
  );
}
