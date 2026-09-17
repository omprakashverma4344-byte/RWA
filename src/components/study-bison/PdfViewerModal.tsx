"use client";

import { useMemo, useState } from "react";
import { api, type ApiContent } from "@/lib/api";
import { X, Download, ExternalLink, Loader2 } from "lucide-react";

export function PdfViewerModal({
  content,
  onClose,
}: {
  content: ApiContent;
  onClose: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const streamUrl = useMemo(
    () =>
      `/api/pdf-proxy?courseId=${encodeURIComponent(
        content.courseId
      )}&contentId=${encodeURIComponent(content.contentId)}`,
    [content.courseId, content.contentId]
  );

  const downloadUrl = streamUrl;

  return (
    <div className="fixed inset-0 z-[80] bg-black/95 backdrop-blur-sm flex flex-col">
      {/* top bar */}
      <div className="flex items-center gap-3 px-4 py-3 text-white/90 border-b border-white/10">
        <FileTextIcon />
        <p className="text-sm font-semibold truncate flex-1">{content.title}</p>
        <button
          onClick={onClose}
          aria-label="Close viewer"
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 text-white/80">
        <a
          href={downloadUrl}
          download={`${content.title || "notes"}.pdf`}
          className="btn-gold rounded-full h-9 px-4 flex items-center gap-1.5 text-xs font-bold"
        >
          <Download className="h-4 w-4" />
          Download
        </a>
        <a
          href={streamUrl}
          target="_blank"
          rel="noreferrer"
          className="glass rounded-full h-9 px-4 flex items-center gap-1.5 text-xs font-bold border border-border"
        >
          <ExternalLink className="h-4 w-4" />
          Open in new tab
        </a>
        <div className="flex-1" />
        <span className="text-[11px] text-muted-foreground hidden sm:block">
          Study Bison Notes
        </span>
      </div>

      {/* pdf frame */}
      <div className="flex-1 relative bg-[#1a1712]">
        {!loaded && !failed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-9 w-9 text-[#e6c26e] animate-spin" />
            <p className="text-sm text-white/70">Loading notes…</p>
          </div>
        ) : null}
        {failed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm text-red-300">
              This PDF could not be displayed (it may have expired). Try again or
              download it.
            </p>
            <button
              onClick={() => {
                setFailed(false);
                setLoaded(false);
              }}
              className="btn-gold rounded-xl px-4 py-2 text-sm font-bold"
            >
              Retry
            </button>
          </div>
        ) : (
          <iframe
            src={streamUrl}
            title={content.title}
            className="absolute inset-0 h-full w-full"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        )}
      </div>
    </div>
  );
}

function FileTextIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 text-[#e6c26e] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  );
}
