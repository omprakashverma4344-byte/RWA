"use client";

import { useStore } from "@/lib/store";
import { api, formatPrice, isBatchNew, type ApiBatch } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

export function BatchCard({ batch }: { batch: ApiBatch }) {
  const push = useStore((s) => s.push);
  const addRecent = useStore((s) => s.addRecent);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const isFavorite = useStore((s) => s.isFavorite);
  const fav = isFavorite(batch.batchId);
  const isNew = isBatchNew(batch);

  const open = () => {
    addRecent(batch);
    push({
      type: "batch",
      batchId: batch.batchId,
      title: batch.batchName,
    });
  };

  return (
    <div className="glass glass-sheen glass-hover rounded-2xl overflow-hidden flex flex-col">
      <div className="relative">
        <button
          onClick={open}
          className="block w-full aspect-[16/9] bg-black/40"
          aria-label={`Open ${batch.batchName}`}
        >
          {batch.thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={batch.thumbUrl}
              alt={batch.batchName}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-4xl">🦬</div>
          )}
        </button>
        {isNew ? (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/90 text-black">
            NEW
          </span>
        ) : null}
        <button
          onClick={() => {
            toggleFavorite(batch);
            toast({
              title: fav ? "Removed from Favorites" : "Added to Favorites",
              description: batch.batchName,
            });
          }}
          aria-label={fav ? "Remove from favorites" : "Add to favorites"}
          aria-pressed={fav}
          className="absolute top-2 right-2 h-9 w-9 rounded-full glass flex items-center justify-center transition-transform hover:scale-110"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill={fav ? "#e6392e" : "none"}
            stroke={fav ? "#e6392e" : "rgba(255,255,255,0.75)"}
            strokeWidth="2"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      <div className="p-3 flex flex-col gap-2.5 flex-1">
        <h3
          className="text-sm font-bold leading-snug line-clamp-2 min-h-[2.5rem] cursor-pointer hover:text-accent-foreground transition-colors"
          onClick={open}
        >
          {batch.batchName}
        </h3>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="font-bold text-[#e6c26e]">
            {formatPrice(batch.price)}
          </span>
          {batch.videoCount ? <span>• {batch.videoCount} videos</span> : null}
          {batch.pdfCount ? <span>• {batch.pdfCount} PDFs</span> : null}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-auto">
          <button
            onClick={open}
            className="btn-gold rounded-xl py-2 text-sm font-bold flex items-center justify-center gap-1.5"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            View
          </button>
          <button
            onClick={() => {
              addRecent(batch);
              push({
                type: "details",
                batchId: batch.batchId,
                title: batch.batchName,
              });
            }}
            className="glass rounded-xl py-2 text-sm font-bold flex items-center justify-center gap-1.5 border border-border hover:border-[rgba(230,194,110,0.45)] transition-colors"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            Details
          </button>
        </div>
      </div>
    </div>
  );
}
