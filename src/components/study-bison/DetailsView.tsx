"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { api, formatPrice, isBatchNew, type ApiBatch } from "@/lib/api";
import { BackHeader, Loader } from "./common";
import { BookOpen, PlayCircle, FileText, Calendar } from "lucide-react";
import { BatchCard } from "./BatchCard";

export function DetailsView({
  batchId,
  onBack,
}: {
  batchId: string;
  onBack: () => void;
}) {
  const [batches, setBatches] = useState<ApiBatch[] | null>(null);
  const batch = batches?.find((b) => b.batchId === batchId);

  useEffect(() => {
    api
      .batches()
      .then(setBatches)
      .catch(() => setBatches([]));
  }, []);

  return (
    <div>
      <BackHeader title="Batch Details" subtitle={`ID: ${batchId}`} onBack={onBack} />
      <div className="px-4 sm:px-6 py-5 pb-10">
        {batches === null ? (
          <Loader label="Loading details…" />
        ) : !batch ? (
          <div className="glass glass-sheen rounded-2xl p-8 text-center">
            <p className="font-bold text-lg gold-text">Batch not found</p>
            <p className="text-sm text-muted-foreground mt-1">
              This batch may no longer be available.
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-5">
            <div className="glass glass-sheen rounded-3xl overflow-hidden">
              <div className="aspect-[16/9] bg-black/40 relative max-h-72">
                {batch.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={batch.thumbUrl}
                    alt={batch.batchName}
                    className="h-full w-full object-cover"
                  />
                ) : null}
                {isBatchNew(batch) ? (
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/90 text-black">
                    NEW
                  </span>
                ) : null}
              </div>
              <div className="p-5 space-y-4">
                <h2 className="text-xl font-extrabold leading-snug gold-text">
                  {batch.batchName}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Stat label="Price" value={formatPrice(batch.price)} />
                  <Stat
                    label="Subjects"
                    value={String(batch.subjectCount ?? 0)}
                    icon={<BookOpen className="h-3.5 w-3.5" />}
                  />
                  <Stat
                    label="Videos"
                    value={String(batch.videoCount ?? 0)}
                    icon={<PlayCircle className="h-3.5 w-3.5" />}
                  />
                  <Stat
                    label="PDFs"
                    value={String(batch.pdfCount ?? 0)}
                    icon={<FileText className="h-3.5 w-3.5" />}
                  />
                </div>
                {batch.startDate ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    Started {batch.startDate}
                  </p>
                ) : null}
              </div>
            </div>

            <div>
              <p className="text-sm font-bold text-muted-foreground mb-3">
                You might also like
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {batches
                  .filter((b) => b.batchId !== batchId)
                  .slice(0, 3)
                  .map((b) => (
                    <BatchCard key={b.batchId} batch={b} />
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="glass rounded-2xl p-3 text-center">
      <p className="text-lg font-extrabold gold-text flex items-center justify-center gap-1.5">
        {icon}
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
