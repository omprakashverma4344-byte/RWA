"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface View {
  type:
    | "dashboard"
    | "favorites"
    | "recent"
    | "saved"
    | "attempts"
    | "new"
    | "old"
    | "batch"
    | "details"
    | "subject"
    | "topic";
  batchId?: string;
  subjectId?: string;
  topicId?: string;
  title?: string;
}

export interface ContentItem {
  id: string;
  contentId: string;
  courseId: string;
  subjectId: string;
  topicId: string;
  title: string;
  materialType: "VIDEO" | "PDF" | "OTHER" | string;
  thumbnail?: string | null;
  dateAndTime?: string | null;
  strtotime?: string | null;
  duration?: string | null;
  liveStatus?: string | null;
  embedUrl?: string | null;
}

export interface BatchItem {
  batchId: string;
  batchName: string;
  thumbUrl?: string | null;
  price?: string;
  startDate?: string | null;
  endDate?: string | null;
  subjectCount?: number;
  videoCount?: number;
  pdfCount?: number;
}

export interface SubjectItem {
  subjectId: string;
  subjectName: string;
  subjectLogo?: string | null;
  isPaid?: string;
}

export interface TopicItem {
  topicId: string;
  topicName: string;
  topicLogo?: string | null;
}

interface StudyBisonState {
  // navigation
  stack: View[];
  push: (v: View) => void;
  pop: () => void;
  reset: (v: View) => void;
  // player
  playerContent: ContentItem | null;
  playerPlaylist: ContentItem[];
  openPlayer: (c: ContentItem, siblings?: ContentItem[]) => void;
  closePlayer: () => void;
  playNextLecture: () => void;
  playPrevLecture: () => void;
  playerMode: "source" | "native";
  setPlayerMode: (m: "source" | "native") => void;
  playerCinema: boolean;
  setPlayerCinema: (v: boolean) => void;
  pdfContent: ContentItem | null;
  openPdf: (c: ContentItem) => void;
  closePdf: () => void;
  // personal data (persisted)
  favorites: Record<string, BatchItem>;
  toggleFavorite: (b: BatchItem) => void;
  isFavorite: (id: string) => boolean;
  recents: BatchItem[];
  addRecent: (b: BatchItem) => void;
  saved: Record<string, ContentItem>;
  toggleSaved: (c: ContentItem) => void;
  isSaved: (id: string) => boolean;
  // ui
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  search: string;
  setSearch: (v: string) => void;
  filter: "all" | "new" | "old";
  setFilter: (v: "all" | "new" | "old") => void;
}

const MAX_RECENTS = 30;

export const useStore = create<StudyBisonState>()(
  persist(
    (set, get) => ({
      stack: [{ type: "dashboard" }],
      push: (v) => set((s) => ({ stack: [...s.stack, v], sidebarOpen: false })),
      pop: () =>
        set((s) => ({
          stack: s.stack.length > 1 ? s.stack.slice(0, -1) : s.stack,
        })),
      reset: (v) => set({ stack: [v], sidebarOpen: false }),

      playerContent: null,
      playerPlaylist: [],
      openPlayer: (c, siblings) =>
        set({
          playerContent: c,
          playerPlaylist:
            siblings && siblings.length > 0
              ? siblings
              : [c],
        }),
      closePlayer: () =>
        set({ playerContent: null, playerPlaylist: [], playerMode: "source" }),
      playNextLecture: () => {
        const { playerContent, playerPlaylist } = get();
        if (!playerContent || playerPlaylist.length === 0) return;
        const i = playerPlaylist.findIndex((p) => p.id === playerContent.id);
        const next = playerPlaylist[i + 1];
        if (next) set({ playerContent: next });
      },
      playPrevLecture: () => {
        const { playerContent, playerPlaylist } = get();
        if (!playerContent || playerPlaylist.length === 0) return;
        const i = playerPlaylist.findIndex((p) => p.id === playerContent.id);
        const prev = i > 0 ? playerPlaylist[i - 1] : undefined;
        if (prev) set({ playerContent: prev });
      },
      playerMode: "source",
      setPlayerMode: (m) => set({ playerMode: m }),
      playerCinema: false,
      setPlayerCinema: (v) => set({ playerCinema: v }),

      pdfContent: null,
      openPdf: (c) => set({ pdfContent: c }),
      closePdf: () => set({ pdfContent: null }),

      favorites: {},
      toggleFavorite: (b) =>
        set((s) => {
          const next = { ...s.favorites };
          if (next[b.batchId]) delete next[b.batchId];
          else next[b.batchId] = b;
          return { favorites: next };
        }),
      isFavorite: (id) => Boolean(get().favorites[id]),

      recents: [],
      addRecent: (b) =>
        set((s) => {
          const next = [b, ...s.recents.filter((r) => r.batchId !== b.batchId)];
          return { recents: next.slice(0, MAX_RECENTS) };
        }),

      saved: {},
      toggleSaved: (c) =>
        set((s) => {
          const next = { ...s.saved };
          if (next[c.id]) delete next[c.id];
          else next[c.id] = c;
          return { saved: next };
        }),
      isSaved: (id) => Boolean(get().saved[id]),

      sidebarOpen: false,
      setSidebarOpen: (v) => set({ sidebarOpen: v }),
      search: "",
      setSearch: (v) => set({ search: v }),
      filter: "all",
      setFilter: (v) => set({ filter: v }),
    }),
    {
      name: "study-bison-storage",
      partialize: (s) => ({
        favorites: s.favorites,
        recents: s.recents,
        saved: s.saved,
      }),
    }
  )
);
