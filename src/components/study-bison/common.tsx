"use client";

import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GlassCard({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("glass glass-sheen rounded-2xl", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function BackHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 sm:px-6 pt-4 pb-3 border-b border-border/60">
      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        aria-label="Go back"
        className="shrink-0 rounded-full hover:bg-accent hover:text-accent-foreground"
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <div className="min-w-0 flex-1">
        <h1 className="text-lg sm:text-xl font-bold truncate gold-text">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        ) : null}
      </div>
      {right}
    </div>
  );
}

export function Loader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-full border-2 border-[rgba(230,194,110,0.15)]" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#e6c26e] animate-spin" />
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-3">
      <div className="h-16 w-16 rounded-full glass glass-sheen flex items-center justify-center text-[#e6c26e]">
        {icon}
      </div>
      <p className="font-semibold text-foreground/90">{title}</p>
      {hint ? (
        <p className="text-sm text-muted-foreground max-w-xs">{hint}</p>
      ) : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
      <p className="text-sm text-red-300/90">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function Chip({
  active,
  children,
  onClick,
  className,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-300 border",
        active
          ? "btn-gold border-transparent"
          : "glass text-muted-foreground hover:text-foreground border-border",
        className
      )}
    >
      {children}
    </button>
  );
}
