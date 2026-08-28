"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
  notifications,
  user,
}: {
  onMenu: () => void;
  notifications: number;
  user: { name: string; email: string; role: string };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
      setFullscreen(false);
    } else {
      void document.documentElement.requestFullscreen().catch(() => undefined);
      setFullscreen(true);
    }
  }

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
        {/* Action cluster from the Figma header. */}
        <Link
          href="/admin/bookings"
          className="hidden h-9 items-center gap-1.5 rounded-lg border border-line px-3 font-admin text-[13px] font-semibold text-ink-700 transition-colors hover:border-ink-300 xl:inline-flex"
        >
          <svg viewBox="0 0 24 24" className="size-4 text-ink-400" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M4 15h16v3a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-.5h-9v.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
            <path d="M5.5 15 7 9.6A2 2 0 0 1 8.9 8h6.2a2 2 0 0 1 1.9 1.6L18.5 15" strokeLinecap="round" />
          </svg>
          Fleet
        </Link>

        <Link
          href="/cars"
          className="hidden h-9 items-center gap-1.5 rounded-lg bg-brand-400 px-3 font-admin text-[13px] font-semibold text-white transition-colors hover:bg-brand-500 sm:inline-flex"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8.5v7M8.5 12h7" strokeLinecap="round" />
          </svg>
          Add New
        </Link>

        <Link
          href="/admin/automations"
          className="hidden h-9 items-center gap-1.5 rounded-lg bg-ink-900 px-3 font-admin text-[13px] font-semibold text-white transition-colors hover:bg-ink-800 sm:inline-flex"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="5" width="18" height="12" rx="2" />
            <path d="M8 21h8" strokeLinecap="round" />
          </svg>
          Runs
        </Link>

        <span
          title="Bangladesh — all amounts in BDT"
          aria-label="Locale: Bangladesh"
          className="hidden size-9 place-items-center rounded-lg border border-line text-[15px] lg:grid"
        >
          🇧🇩
        </span>

        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={fullscreen ? "Exit full screen" : "Enter full screen"}
          className="hidden size-9 place-items-center rounded-lg border border-line text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-900 lg:grid"
        >
          <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7">
            {fullscreen ? (
              <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        </button>

        <Link
          href="/admin/automations"
          aria-label="Outbox"
          className="relative hidden size-9 place-items-center rounded-lg border border-line text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-900 md:grid"
        >
          <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3.5 7 8.5 6 8.5-6" strokeLinecap="round" />
          </svg>
        </Link>



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

        <Link
          href="/admin/ai"
          aria-label="AI settings"
          className="hidden size-9 place-items-center rounded-lg border border-line text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-900 md:grid"
        >
          <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
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
