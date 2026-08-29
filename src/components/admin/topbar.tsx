"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { SignOutButton } from "./sign-out";

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
  // Below `sm` the search collapses to an icon rather than disappearing.
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  const initials = user.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  // A menu that only closes by pressing its own button is a trap on touch,
  // where there is no Escape key and nothing else to click.
  useEffect(() => {
    if (!accountOpen) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accountOpen]);

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

      <h1
        className={cn(
          "font-admin text-[15px] font-bold text-ink-900 lg:hidden",
          searchOpen && "hidden sm:block lg:hidden",
        )}
      >
        {TITLES[pathname] ?? "Admin"}
      </h1>

      {/*
        The search used to be `hidden sm:block`, so on a phone it was not
        collapsed — it was gone, and with it the only way to look a booking
        reference up. It now toggles open in place, which is what the rest of
        the header already does with its action cluster.
      */}
      <button
        type="button"
        onClick={() => {
          setSearchOpen(true);
          window.setTimeout(() => searchRef.current?.focus(), 0);
        }}
        aria-label="Search"
        aria-expanded={searchOpen}
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-lg border border-ink-200 text-ink-600 sm:hidden",
          searchOpen && "hidden",
        )}
      >
        <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="9" cy="9" r="6" />
          <path d="m17 17-3.5-3.5" strokeLinecap="round" />
        </svg>
      </button>

      <form onSubmit={submit} className={cn("relative max-w-md flex-1 sm:block", searchOpen ? "block" : "hidden")}>
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
          // White, not `bg-canvas`. The grey fill read as a disabled field
          // sitting on an already-grey top bar, so the one control an operator
          // reaches for most looked like the one they could not use.
          className="h-10 w-full rounded-lg border border-line bg-white pr-16 pl-10 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-line bg-white px-1.5 py-0.5 font-sans text-[10px] font-semibold text-ink-400 sm:block">
          ⌘K
        </kbd>
        <button
          type="button"
          onClick={() => setSearchOpen(false)}
          aria-label="Close search"
          className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-ink-400 sm:hidden"
        >
          <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m5 5 10 10M15 5 5 15" strokeLinecap="round" />
          </svg>
        </button>
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

        {/*
          "Add New" went to /cars — the *public* fleet listing. Pressing the
          primary create button in the operations dashboard dropped an operator
          onto the customer-facing catalogue with nothing to add. The
          neighbouring "Fleet" link is the one that browses; this one creates.
        */}
        <Link
          href="/admin/fleet/new"
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
          // Says what the number is on hover, not just to a screen reader —
          // a bare red count invites "19 what?", and it is the kind of badge
          // people expect to clear as they work, which it now does.
          title={notifications > 0 ? `${notifications} hot leads not yet contacted` : "No hot leads waiting"}
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

        {/*
          The avatar was a `span` with a tooltip — it looked like the account
          control every dashboard puts in that corner and did nothing when
          clicked. It is now the menu it appeared to be, and it holds the
          account block that used to sit at the bottom of the sidebar, where it
          cost permanent vertical space to say something you need once.
        */}
        <div ref={accountRef} className="relative">
          <button
            type="button"
            onClick={() => setAccountOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={accountOpen}
            aria-label={`Account: ${user.name}`}
            className="grid size-9 place-items-center rounded-full bg-ink-900 font-admin text-[12px] font-bold text-white transition-opacity hover:opacity-90"
          >
            {initials}
          </button>

          {accountOpen && (
            <div
              role="menu"
              className="absolute top-11 right-0 z-50 w-60 overflow-hidden rounded-xl border border-line bg-white shadow-lift"
            >
              <div className="flex items-center gap-2.5 border-b border-line bg-canvas px-3.5 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink-900 font-admin text-[11px] font-bold text-white">
                  {initials}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-admin text-[13px] font-bold text-ink-900">{user.name}</span>
                  <span className="block truncate text-[11px] text-ink-400 capitalize">{user.role}</span>
                  <span className="block truncate text-[11px] text-ink-400">{user.email}</span>
                </span>
              </div>

              <Link
                href="/"
                onClick={() => setAccountOpen(false)}
                className="flex items-center gap-3 px-3.5 py-2.5 font-admin text-[14px] font-semibold text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900"
              >
                <svg viewBox="0 0 24 24" className="size-[18px] shrink-0 text-ink-400" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5M10 8l-4 4 4 4M6 12h10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Back to site
              </Link>

              <div className="px-1.5 pb-1.5">
                <SignOutButton />
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
