import Link from "next/link";

import { cn } from "@/lib/utils";

/** Wordmark with the swoosh from the Figma dashboard header, redrawn as an SVG. */
export function Logo({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-2.5", className)} aria-label="Best Auto — home">
      <span className="relative grid size-9 place-items-center rounded-xl bg-brand-400 text-white shadow-[0_8px_18px_-8px_rgba(255,159,67,0.9)] transition-transform duration-300 group-hover:-rotate-6">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M4 15h16v3a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-.5h-9v.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
          <path d="M5.5 15 7 9.6A2 2 0 0 1 8.9 8h6.2a2 2 0 0 1 1.9 1.6L18.5 15" strokeLinecap="round" />
          <circle cx="7.8" cy="12.4" r=".9" fill="currentColor" stroke="none" />
          <circle cx="16.2" cy="12.4" r=".9" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display text-[19px] font-bold tracking-tight",
            tone === "light" ? "text-white" : "text-ink-900",
          )}
        >
          Best<span className="text-brand-400">Auto</span>
        </span>
        <span className={cn("text-[10px] tracking-[0.18em] uppercase", tone === "light" ? "text-white/60" : "text-ink-400")}>
          Car rental UK
        </span>
      </span>
    </Link>
  );
}
