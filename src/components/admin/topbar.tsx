"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const TITLES: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/vehicles": "Vehicles",
  "/admin/bookings": "Bookings",
  "/admin/customers": "Customers",
  "/admin/leads": "Leads",
  "/admin/ai": "AI console",
  "/admin/automations": "Automations",
};

export function AdminTopbar({
  onMenu,
  engine,
  notifications,
  user,
}: {
  onMenu: () => void;
  engine: { engine: string; model: string; hosted: boolean };
  notifications: number;
  user: { name: string; email: string; role: string };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl-K focuses search, matching the shortcut hinted in the design.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (q) router.push(`/admin/bookings?q=${encodeURIComponent(q)}`);
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-white px-4 lg:px-6">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open navigation"
        className="grid size-9 place-items-center rounded-lg border border-ink-200 text-ink-600 lg:hidden"
      >
        <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
      </button>

      <h1 className="font-admin text-[15px] font-bold text-ink-900 lg:hidden">{TITLES[pathname] ?? "Admin"}</h1>

      <form onSubmit={submit} className="relative hidden max-w-md flex-1 sm:block">
        <svg
          viewBox="0 0 20 20"
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-300"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <circle cx="9" cy="9" r="6" />
          <path d="m17 17-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search bookings, customers, references"
          aria-label="Search"
          className="h-10 w-full rounded-lg border border-line bg-canvas pr-16 pl-10 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-300 focus:border-brand-300 focus:bg-white"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded border border-line bg-white px-1.5 py-0.5 font-sans text-[10px] font-semibold text-ink-400">
          ⌘K
        </kbd>
      </form>

      <div className="ml-auto flex items-center gap-2">
        <span
          className={cn(
            "hidden items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold md:inline-flex",
            engine.hosted ? "border-success/25 bg-success-soft text-success" : "border-line bg-canvas text-ink-500",
          )}
          title={engine.hosted ? `Hosted model: ${engine.model}` : "No model key configured — deterministic engine"}
        >
          <span className={cn("size-1.5 rounded-full", engine.hosted ? "bg-success" : "bg-ink-300")} />
          AI: {engine.hosted ? engine.model : "rules engine"}
        </span>

        <Link
          href="/admin/leads"
          aria-label={`${notifications} hot leads waiting`}
          className="relative grid size-9 place-items-center rounded-lg border border-line text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-900"
        >
          <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 20a2 2 0 0 1-3.4 0" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {notifications > 0 && (
            <span className="absolute -top-1 -right-1 grid min-w-4.5 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
              {notifications > 99 ? "99" : notifications}
            </span>
          )}
        </Link>

        <span
          title={`${user.name} (${user.email})`}
          className="grid size-9 place-items-center rounded-full bg-ink-900 font-admin text-[12px] font-bold text-white"
        >
          {user.name
            .split(" ")
            .slice(0, 2)
            .map((w) => w[0])
            .join("")
            .toUpperCase()}
        </span>
      </div>
    </header>
  );
}
