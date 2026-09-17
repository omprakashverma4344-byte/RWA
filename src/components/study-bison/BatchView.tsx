"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { api, type ApiSubject } from "@/lib/api";
import { BackHeader, EmptyState, ErrorState, Loader } from "./common";
import { BookOpen, Radio, ClipboardList, Tv, History } from "lucide-react";

type Tab = "subjects" | "live" | "tests";

function SubjectsTab({ batchId }: { batchId: string }) {
  const push = useStore((s) => s.push);
  const [subjects, setSubjects] = useState<ApiSubject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    api
      .subjects(batchId)
      .then((d) => {
        if (alive) setSubjects(d);
      })
      .catch((e) => {
        if (alive) setError(String(e.message || e));
      });
    return () => {
      alive = false;
    };
  }, [batchId, reload]);

  if (error)
    return (
      <ErrorState
        message={`Could not load subjects: ${error}`}
        onRetry={() => {
          setError(null);
          setReload((r) => r + 1);
        }}
      />
    );
  if (subjects === null) return <Loader label="Loading subjects…" />;
  if (subjects.length === 0)
    return (
      <EmptyState
        icon={<BookOpen className="h-8 w-8" />}
        title="No subjects found"
        hint="This batch has no published subjects yet."
      />
    );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {subjects.map((s) => (
        <button
          key={s.subjectId}
          onClick={() =>
            push({
              type: "subject",
              batchId,
              subjectId: s.subjectId,
              title: s.subjectName,
            })
          }
          className="glass glass-sheen glass-hover rounded-2xl p-4 flex flex-col items-center gap-3 text-center"
        >
          <div className="h-20 w-20 rounded-2xl overflow-hidden bg-black/40 border border-border flex items-center justify-center">
            {s.subjectLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s.subjectLogo}
                alt={s.subjectName}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <BookOpen className="h-8 w-8 text-[#e6c26e]" />
            )}
          </div>
          <p className="text-sm font-semibold leading-snug line-clamp-2">
            {s.subjectName}
          </p>
        </button>
      ))}
    </div>
  );
}

interface LiveItem {
  id?: string;
  Title?: string;
  title?: string;
  thumbnail?: string;
  date_and_time?: string;
  [k: string]: unknown;
}

function LiveTab({ batchId }: { batchId: string }) {
  const [data, setData] = useState<{ upcoming: LiveItem[]; previous: LiveItem[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [sub, setSub] = useState<"upcoming" | "previous">("upcoming");

  useEffect(() => {
    let alive = true;
    api
      .live(batchId)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) setError(String(e.message || e));
      });
    return () => {
      alive = false;
    };
  }, [batchId, reload]);

  if (error)
    return (
      <ErrorState
        message={`Could not load live classes: ${error}`}
        onRetry={() => {
          setError(null);
          setReload((r) => r + 1);
        }}
      />
    );
  if (data === null) return <Loader label="Loading live classes…" />;

  const items = sub === "upcoming" ? data.upcoming : data.previous;

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSub("upcoming")}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
            sub === "upcoming"
              ? "btn-gold border-transparent"
              : "glass border-border text-muted-foreground"
          }`}
        >
          <Tv className="inline h-4 w-4 mr-1.5" />
          Live & Upcoming
        </button>
        <button
          onClick={() => setSub("previous")}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
            sub === "previous"
              ? "btn-gold border-transparent"
              : "glass border-border text-muted-foreground"
          }`}
        >
          <History className="inline h-4 w-4 mr-1.5" />
          Previous Ended
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<Radio className="h-8 w-8" />}
          title={sub === "upcoming" ? "No live or upcoming classes" : "No previous classes"}
          hint="Check back later for scheduled sessions."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((it, i) => (
            <div key={String(it.id ?? i)} className="glass glass-sheen rounded-2xl overflow-hidden">
              <div className="aspect-video bg-black/40 relative">
                {it.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : null}
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/90 text-white flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  {sub === "upcoming" ? "LIVE" : "ENDED"}
                </span>
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold line-clamp-2">{String(it.Title ?? it.title ?? "Class")}</p>
                {it.date_and_time ? (
                  <p className="text-xs text-muted-foreground mt-1">{String(it.date_and_time)}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TestsTab({ batchId }: { batchId: string }) {
  const [tests, setTests] = useState<unknown[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    api
      .tests(batchId)
      .then((d) => {
        if (alive) setTests(d);
      })
      .catch((e) => {
        if (alive) setError(String(e.message || e));
      });
    return () => {
      alive = false;
    };
  }, [batchId, reload]);

  if (error)
    return (
      <ErrorState
        message={`Could not load tests: ${error}`}
        onRetry={() => {
          setError(null);
          setReload((r) => r + 1);
        }}
      />
    );
  if (tests === null) return <Loader label="Loading tests…" />;
  if (tests.length === 0)
    return (
      <EmptyState
        icon={<ClipboardList className="h-8 w-8" />}
        title="No tests found"
        hint="Tests & quizzes for this batch will appear here."
      />
    );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {tests.map((t, i) => {
        const obj = (t ?? {}) as Record<string, unknown>;
        return (
          <div key={String(obj.id ?? i)} className="glass glass-sheen rounded-2xl p-4">
            <p className="text-sm font-semibold line-clamp-2">
              {String(obj.title ?? obj.name ?? obj.test_name ?? "Test")}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function BatchView({
  batchId,
  batchName,
  onBack,
}: {
  batchId: string;
  batchName?: string;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<Tab>("subjects");

  return (
    <div>
      <BackHeader
        title={batchName ?? "Subjects"}
        subtitle={`Batch ID: ${batchId}`}
        onBack={onBack}
      />
      <div className="px-4 sm:px-6 pt-4">
        <div className="glass glass-sheen rounded-2xl p-1 grid grid-cols-3 gap-1">
          {(
            [
              { key: "subjects", label: "Subjects", icon: BookOpen },
              { key: "live", label: "Live", icon: Radio },
              { key: "tests", label: "Tests", icon: ClipboardList },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                tab === key
                  ? "btn-gold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        <div className="mt-5 pb-10">
          {tab === "subjects" && <SubjectsTab batchId={batchId} />}
          {tab === "live" && <LiveTab batchId={batchId} />}
          {tab === "tests" && <TestsTab batchId={batchId} />}
        </div>
      </div>
    </div>
  );
}
