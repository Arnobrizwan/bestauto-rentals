"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { cn } from "@/lib/utils";

/** Debounced search box that writes `q` into the URL. */
export function TableSearch({ placeholder = "Search…" }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const [, startTransition] = useTransition();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const current = params.get("q") ?? "";
      if (value === current) return;
      const next = new URLSearchParams(params.toString());
      if (value) next.set("q", value);
      else next.delete("q");
      next.delete("page");
      startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
    }, 320);
    return () => window.clearTimeout(timer);
  }, [value, params, pathname, router]);

  return (
    <div className="relative min-w-0 flex-1 sm:max-w-xs">
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
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 w-full rounded-lg border border-line bg-white pr-3 pl-10 text-sm outline-none transition-colors placeholder:text-ink-300 focus:border-brand-300"
      />
    </div>
  );
}

/** Segmented filter that writes a single param into the URL. */
export function FilterTabs({
  name,
  options,
  fallback = "all",
}: {
  name: string;
  options: { value: string; label: string; count?: number }[];
  fallback?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get(name) ?? fallback;

  function select(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === fallback) next.delete(name);
    else next.set(name, value);
    next.delete("page");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="flex gap-1 overflow-x-auto rounded-lg bg-ink-50 p-1 no-scrollbar">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => select(option.value)}
          aria-pressed={current === option.value}
          className={cn(
            "shrink-0 rounded-md px-3 py-1.5 font-admin text-[13px] font-semibold transition-colors",
            current === option.value ? "bg-white text-ink-900 shadow-card" : "text-ink-500 hover:text-ink-900",
          )}
        >
          {option.label}
          {option.count !== undefined && <span className="ml-1.5 text-ink-400">{option.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function SortMenu({ options }: { options: { value: string; label: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <select
      value={params.get("sort") ?? options[0].value}
      onChange={(e) => {
        const next = new URLSearchParams(params.toString());
        next.set("sort", e.target.value);
        next.delete("page");
        router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      }}
      aria-label="Sort"
      className="h-10 shrink-0 rounded-lg border border-line bg-white px-3 font-admin text-[13px] font-semibold text-ink-900 outline-none focus:border-brand-300"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Pagination({ page, pageCount, total }: { page: number; pageCount: number; total: number }) {
  const params = useSearchParams();
  const pathname = usePathname();
  if (pageCount <= 1) return <p className="px-5 py-4 text-[13px] text-ink-400">{total} results</p>;

  function href(n: number) {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(n));
    return `${pathname}?${next.toString()}`;
  }

  const windowed = Array.from({ length: pageCount }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === pageCount || Math.abs(n - page) <= 1,
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5">
      <p className="text-[13px] text-ink-400">
        Page {page} of {pageCount} · {total} results
      </p>
      <div className="flex items-center gap-1">
        {page > 1 && (
          <Link href={href(page - 1)} className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-semibold text-ink-600 hover:border-ink-300">
            Prev
          </Link>
        )}
        {windowed.map((n, i) => (
          <span key={n} className="flex items-center gap-1">
            {i > 0 && windowed[i - 1] !== n - 1 && <span className="px-1 text-ink-300">…</span>}
            <Link
              href={href(n)}
              aria-current={n === page ? "page" : undefined}
              className={cn(
                "grid size-9 place-items-center rounded-lg text-[13px] font-semibold",
                n === page ? "bg-ink-900 text-white" : "border border-line text-ink-600 hover:border-ink-300",
              )}
            >
              {n}
            </Link>
          </span>
        ))}
        {page < pageCount && (
          <Link href={href(page + 1)} className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-semibold text-ink-600 hover:border-ink-300">
            Next
          </Link>
        )}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-admin text-2xl font-bold text-ink-900">{title}</h1>
        <p className="mt-1 text-[14px] text-ink-400">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}
