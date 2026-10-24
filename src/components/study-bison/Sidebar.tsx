"use client";

import { cn } from "@/lib/utils";
import { useStore, type View } from "@/lib/store";
import {
  Home,
  Sparkles,
  Archive,
  Clock,
  Star,
  Bookmark,
  ClipboardList,
  X,
  Database,
  Send,
} from "lucide-react";
import { useEffect, useState } from "react";

function LibraryStatus() {
  const [status, setStatus] = useState<{ done: number; total: number; running: boolean; finished: boolean } | null>(null);
  useEffect(() => {
    let alive = true;
    const tick = () => {
      fetch("/api/scrape-status")
        .then((r) => r.json())
        .then((d) => {
          if (!alive || !d?.available) return;
          setStatus({
            done: d.doneBatches ?? 0,
            total: d.totalBatches ?? 0,
            running: Boolean(d.running),
            finished: Boolean(d.finished),
          });
        })
        .catch(() => undefined);
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  if (!status || status.total === 0) return null;
  const pct = Math.min(100, Math.round((status.done / status.total) * 100));
  return (
    <div aria-live="polite">
      <p className="flex items-center gap-1.5">
        <Database className={cn("h-3 w-3", status.running ? "text-[#e6c26e]" : "")} />
        {status.finished
          ? `Library indexed: ${status.done}/${status.total}`
          : status.running
            ? `Indexing library… ${status.done}/${status.total} (${pct}%)`
            : `Library: ${status.done}/${status.total} indexed`}
      </p>
      {!status.finished ? (
        <div className="h-1 rounded-full bg-white/10 overflow-hidden mt-1">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#f2d98a] to-[#c89b2c] transition-all duration-700"
            style={{ width: `${Math.max(pct, 2)}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

const NAV_ITEMS: { key: string; label: string; icon: React.ElementType; view: View }[] = [
  { key: "home", label: "Home", icon: Home, view: { type: "dashboard" } },
  { key: "new", label: "New Batch", icon: Sparkles, view: { type: "new" } },
  { key: "old", label: "Old Batch", icon: Archive, view: { type: "old" } },
  { key: "recent", label: "Recent", icon: Clock, view: { type: "recent" } },
  { key: "favorites", label: "Favorites", icon: Star, view: { type: "favorites" } },
  { key: "saved", label: "Saved", icon: Bookmark, view: { type: "saved" } },
  { key: "attempts", label: "My Attempts", icon: ClipboardList, view: { type: "attempts" } },
];

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const stack = useStore((s) => s.stack);
  const reset = useStore((s) => s.reset);
  const current = stack[stack.length - 1];

  const go = (v: View) => {
    reset(v);
    onClose?.();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Brand header */}
      <div className="flex items-center gap-3 p-5 border-b border-sidebar-border/60">
        <div className="h-11 w-11 rounded-2xl overflow-hidden glass gold-border-glow shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/branding/logo.png"
            alt="STUDY PREMIUM logo"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-lg leading-tight gold-text">
            STUDY PREMIUM
          </p>
          <p className="text-[11px] text-muted-foreground">
            Made with 🦬 for learners
          </p>
        </div>
        {onClose ? (
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="lg:hidden p-2 rounded-full hover:bg-accent text-muted-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1" aria-label="Main navigation">
        <p className="px-3 pt-2 pb-1 text-[11px] font-bold tracking-[0.14em] text-muted-foreground/70">
          NAVIGATION
        </p>
        {NAV_ITEMS.map(({ key, label, icon: Icon, view }) => {
          const active =
            (current.type === view.type) ||
            (view.type === "dashboard" && current.type === "dashboard");
          return (
            <button
              key={key}
              onClick={() => go(view)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 group",
                active
                  ? "glass gold-border-glow text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 transition-transform duration-300 group-hover:scale-110",
                  active ? "text-[#e6c26e]" : ""
                )}
              />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border/60 text-[11px] text-muted-foreground/70 safe-bottom space-y-2">
        <a
          href="https://t.me/+gbzcsyH9ApsxNzk1"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 rounded-xl glass glass-hover text-[#e6c26e] hover:text-[#f2d98a] transition-colors text-xs font-medium w-full"
        >
          <Send className="h-4 w-4" />
          Join Telegram
        </a>
        <LibraryStatus />
        <p>© {new Date().getFullYear()} STUDY PREMIUM</p>
      </div>
    </div>
  );
}
