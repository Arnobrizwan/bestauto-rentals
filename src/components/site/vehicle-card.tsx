"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useSyncExternalStore } from "react";

import { cn, formatCurrency } from "@/lib/utils";

export type VehicleCardData = {
  slug: string;
  name: string;
  brand: string;
  bodyType: string;
  transmission: string;
  fuel: string;
  seats: number;
  bags: number;
  pricePerDay: number;
  imageUrl: string;
  rating: number;
  reviewCount: number;
  segment: string;
  location: string;
  unitsAvailable: number;
};

const SPEC_ICONS = {
  seats: "M7 11V7a5 5 0 0 1 10 0v4m-11 0h12a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1Z",
  gear: "M12 3v6m0 0-2.5 2.5M12 9l2.5 2.5M6 15h12M8 21h8",
  fuel: "M5 21V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v16M4 21h12M14 9h3a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0V9l-2.5-2.5",
  bag: "M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-11 0h14a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z",
} as const;

function Spec({ icon, label }: { icon: keyof typeof SPEC_ICONS; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-500">
      <svg viewBox="0 0 24 24" className="size-4 text-ink-300" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d={SPEC_ICONS[icon]} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </span>
  );
}

/* ---------------------------------------------------------------------------
   Favourites live in localStorage, which is an external store. Reading it
   through useSyncExternalStore keeps render pure, gives every card on the page
   a consistent value, and renders correctly on the server (empty list).
--------------------------------------------------------------------------- */
const FAVOURITES_KEY = "bestauto.favourites";

const listeners = new Set<() => void>();
let snapshot = "[]";

function readRaw() {
  try {
    return window.localStorage.getItem(FAVOURITES_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function parse(raw: string): string[] {
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? (value as string[]) : [];
  } catch {
    return [];
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab writing the same key should update this one too.
  const onStorage = (e: StorageEvent) => {
    if (e.key === FAVOURITES_KEY) emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function emit() {
  const next = readRaw();
  if (next === snapshot) return;
  snapshot = next;
  for (const listener of listeners) listener();
}

/** Cached so repeated calls return a referentially stable string. */
function getSnapshot() {
  const raw = readRaw();
  if (raw !== snapshot) snapshot = raw;
  return snapshot;
}

const getServerSnapshot = () => "[]";

function writeFavourites(next: string[]) {
  try {
    window.localStorage.setItem(FAVOURITES_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable (private mode, blocked cookies) - ignore */
  }
  snapshot = JSON.stringify(next);
  for (const listener of listeners) listener();
}

export function VehicleCard({
  vehicle,
  priority = false,
  className,
}: {
  vehicle: VehicleCardData;
  priority?: boolean;
  className?: string;
}) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const favourite = parse(raw).includes(vehicle.slug);
  const params = useSearchParams();

  /*
   * Carry the search across the hop into the car.
   *
   * A customer who searched 1–4 September at Dhaka Banani, browsed the fleet
   * and opened a car used to land on a booking form defaulted to three days
   * from today at the branch the car happens to sit in — their dates dropped
   * silently at the last step, and the price they were quoted was for a
   * different hire than the one they asked for. The card link forwards what
   * they chose; the booking form reads it. On the home page, where there is no
   * search, nothing is appended and the link stays clean.
   */
  const carried = new URLSearchParams();
  for (const key of ["pickup", "dropoff", "location"]) {
    const value = params.get(key);
    if (value) carried.set(key, value);
  }
  const query = carried.toString();
  const href = query ? `/cars/${vehicle.slug}?${query}` : `/cars/${vehicle.slug}`;

  const toggleFavourite = useCallback(() => {
    const current = parse(readRaw());
    const without = current.filter((slug) => slug !== vehicle.slug);
    // Nothing was removed, so it was not a favourite - add it.
    writeFavourites(without.length === current.length ? [...without, vehicle.slug] : without);
  }, [vehicle.slug]);

  const scarce = vehicle.unitsAvailable <= 1;

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-white transition-all duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-lift",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <h3 className="truncate font-display text-[17px] font-semibold text-ink-900">{vehicle.name}</h3>
          <p className="mt-0.5 text-[13px] text-ink-400">
            {vehicle.bodyType} · {vehicle.location}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleFavourite}
          aria-pressed={favourite}
          aria-label={favourite ? `Remove ${vehicle.name} from favourites` : `Save ${vehicle.name} to favourites`}
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full border transition-all",
            favourite
              ? "border-danger/30 bg-danger-soft text-danger"
              : "border-ink-200 text-ink-300 hover:border-danger/40 hover:text-danger",
          )}
        >
          <svg viewBox="0 0 24 24" className="size-4" fill={favourite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
            <path d="M12 20.4 4.6 13a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9A4.6 4.6 0 1 1 19.4 13z" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <Link href={href} className="mt-4 block px-5" tabIndex={-1} aria-hidden>
        <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-ink-50">
          <Image
            src={vehicle.imageUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 24vw"
            priority={priority}
            className="object-cover transition-transform duration-700 group-hover:scale-[1.06]"
          />
          {scarce && (
            <span className="absolute top-2.5 left-2.5 rounded-md bg-danger px-2 py-1 text-[11px] font-semibold text-white">
              Last one
            </span>
          )}
          <span className="absolute right-2.5 bottom-2.5 inline-flex items-center gap-1 rounded-md bg-white/95 px-2 py-1 text-[11px] font-semibold text-ink-900 backdrop-blur">
            <svg viewBox="0 0 24 24" className="size-3 text-brand-400" fill="currentColor">
              <path d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.6l1.1-6L3.4 9.4l6-.8z" />
            </svg>
            {vehicle.rating.toFixed(1)}
          </span>
        </div>
      </Link>

      <div className="flex flex-wrap gap-x-4 gap-y-2 px-5 pt-4">
        <Spec icon="seats" label={`${vehicle.seats} seats`} />
        <Spec icon="gear" label={vehicle.transmission} />
        <Spec icon="fuel" label={vehicle.fuel} />
        <Spec icon="bag" label={`${vehicle.bags} bags`} />
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 px-5 py-5">
        <p className="font-display text-[19px] font-bold text-ink-900">
          {formatCurrency(vehicle.pricePerDay)}
          <span className="ml-0.5 text-[13px] font-medium text-ink-400">/ day</span>
        </p>
        <Link
          href={href}
          className="inline-flex h-10 items-center rounded-full border border-ink-200 px-5 text-sm font-semibold text-ink-900 transition-all group-hover:border-brand-400 group-hover:bg-brand-400 group-hover:text-white"
        >
          Rent Now
        </Link>
      </div>
    </article>
  );
}
