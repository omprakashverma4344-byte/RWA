"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { Sidebar } from "./Sidebar";
import { DashboardView } from "./DashboardView";
import { BatchView } from "./BatchView";
import { TopicsView, TopicView } from "./TopicView";
import { DetailsView } from "./DetailsView";
import { SimpleListView } from "./SimpleListView";
import { VideoPlayerModal } from "./VideoPlayerModal";
import { PdfViewerModal } from "./PdfViewerModal";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Moon, Sun, Send } from "lucide-react";

function useCourseCount() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/batches")
      .then((r) => r.json())
      .then((d) => setCount(Array.isArray(d) ? d.length : null))
      .catch(() => setCount(null));
  }, []);
  return count;
}

export function StudyBisonApp() {
  const stack = useStore((s) => s.stack);
  const push = useStore((s) => s.push);
  const pop = useStore((s) => s.pop);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const playerContent = useStore((s) => s.playerContent);
  const closePlayer = useStore((s) => s.closePlayer);
  const pdfContent = useStore((s) => s.pdfContent);
  const closePdf = useStore((s) => s.closePdf);

  const [light, setLight] = useState(false);
  const courseCount = useCourseCount();

  const current = stack[stack.length - 1];

  const toggleTheme = () => {
    setLight((l) => {
      document.documentElement.classList.toggle("light", !l);
      document.documentElement.classList.toggle("dark", l);
      return !l;
    });
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden relative">
      {/* ambient orbs */}
      <div className="orb orb-gold-1" aria-hidden />
      <div className="orb orb-gold-2" aria-hidden />

      {/* Header */}
      <header className="shrink-0 z-50 glass border-x-0 border-t-0 rounded-none">
        <div className="flex items-center gap-3 px-3 sm:px-5 h-16">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="p-2.5 rounded-xl hover:bg-accent transition-colors lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <button
            onClick={() => push({ type: "dashboard" })}
            className="flex items-center gap-3 group"
          >
            <div className="h-10 w-10 rounded-2xl overflow-hidden glass gold-border-glow">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/branding/logo.png"
                alt="STUDY PREMIUM logo"
                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className="text-left">
              <p className="font-extrabold text-base sm:text-lg leading-tight gold-text">
                STUDY PREMIUM
              </p>
              <p className="text-[11px] text-muted-foreground leading-tight">
                {courseCount ? `${courseCount} courses` : "Loading courses…"}
              </p>
            </div>
          </button>
          <div className="flex-1" />
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="p-2.5 rounded-xl hover:bg-accent transition-colors text-[#e6c26e]"
          >
            {light ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 relative z-10">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-72 shrink-0 p-3 pr-0 min-h-0">
          <div className="h-full glass glass-sheen rounded-3xl overflow-hidden">
            <Sidebar />
          </div>
        </aside>

        {/* Mobile sidebar drawer */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="p-0 w-72 bg-transparent border-0">
            <SheetTitle className="sr-only">Navigation menu</SheetTitle>
            <div className="h-full rounded-r-3xl bg-[#0e0c08] border-r border-sidebar-border/60 shadow-2xl overflow-hidden">
              <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>

        {/* Main view */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          {current.type === "dashboard" && <DashboardView />}
          {current.type === "batch" && (
            <BatchView
              batchId={current.batchId!}
              batchName={current.title}
              onBack={pop}
            />
          )}
          {current.type === "details" && (
            <DetailsView batchId={current.batchId!} onBack={pop} />
          )}
          {current.type === "subject" && (
            <TopicsView
              batchId={current.batchId!}
              subjectId={current.subjectId!}
              subjectName={current.title}
              onBack={pop}
            />
          )}
          {current.type === "topic" && (
            <TopicView
              batchId={current.batchId!}
              subjectId={current.subjectId!}
              topicId={current.topicId!}
              topicName={current.title}
              onBack={pop}
            />
          )}
          {(current.type === "favorites" ||
            current.type === "recent" ||
            current.type === "saved" ||
            current.type === "attempts" ||
            current.type === "new" ||
            current.type === "old") && (
            <SimpleListView type={current.type} onBack={pop} />
          )}
        </main>
      </div>

      {/* Sticky footer */}
      <footer className="relative z-10 shrink-0 border-t border-border/60 glass border-x-0 border-b-0 rounded-none safe-bottom">
        <div className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p className="flex items-center gap-2">
            <span className="h-5 w-5 rounded-lg overflow-hidden inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/branding/logo.png" alt="" className="h-full w-full object-cover" />
            </span>
            <span>
              © {new Date().getFullYear()} <span className="gold-text font-bold">STUDY PREMIUM</span> — Made with 🦬 for learners
            </span>
          </p>
          <div className="flex items-center gap-3">
            <a
              href="https://t.me/+gbzcsyH9ApsxNzk1"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass glass-hover text-[#e6c26e] hover:text-[#f2d98a] transition-colors text-xs font-medium"
            >
              <Send className="h-3.5 w-3.5" />
              Telegram
            </a>
            <span>Premium lectures · Notes · PDFs — all in one place</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {playerContent ? (
        <VideoPlayerModal
          key={playerContent.id}
          content={playerContent}
          onClose={closePlayer}
        />
      ) : null}
      {pdfContent ? (
        <PdfViewerModal content={pdfContent} onClose={closePdf} />
      ) : null}
    </div>
  );
}
