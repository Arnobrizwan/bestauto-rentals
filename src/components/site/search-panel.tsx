"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useSyncExternalStore } from "react";

import { nearestBranch } from "@/lib/geo";
import { cn } from "@/lib/utils";

const TIMES = ["08:00", "09:00", "10:00", "11:00", "12:00", "14:00", "16:00", "18:00", "20:00"];

function isoIn(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * The pick-up / drop-off panel from the wireframe, wired to the fleet search.
 * Submitting pushes the criteria into /cars as query params so the result page
 * is linkable and server-rendered.
 */
/**
 * The branch the proxy worked out for this request.
 *
 * Read through `useSyncExternalStore` rather than in a `useState` initialiser
 * because the home page is prerendered: the server has no cookie, the client
 * does, and reading it during the first client render would be a hydration
 * mismatch on the select's value. The server snapshot is the plain default, so
 * the markup matches, and React re-renders with the real branch immediately
 * after. Same pattern the favourites store on the vehicle card uses.
 */
function readBranchCookie() {
  const match = document.cookie.match(/(?:^|;\s*)bestauto_branch=([^;]*)/);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return "";
  }
}

let branchSnapshot = "";
function subscribeBranch(onStoreChange: () => void) {
  // The cookie is written by the proxy before the document loads and never
  // changes while the page is open, so there is no event to listen for — but
  // React holds the *server* snapshot through hydration and only re-reads when
  // the store says it changed. One notification on the next tick is what swaps
  // the placeholder for the visitor's real branch. Without it the value is
  // read once, during hydration, and the geo default silently never applies.
  const timer = window.setTimeout(onStoreChange, 0);
  return () => window.clearTimeout(timer);
}
function getBranchSnapshot() {
  const next = readBranchCookie();
  if (next !== branchSnapshot) branchSnapshot = next;
  return branchSnapshot;
}
const getBranchServerSnapshot = () => "";

export function SearchPanel({ locations, className }: { locations: string[]; className?: string }) {
  const router = useRouter();
  const id = useId();
  // The visitor's own city first, then a Dhaka branch — it is the busiest by a
  // wide margin and reads better than whatever happens to sort first
  // alphabetically. A branch is only adopted if it is one we actually run.
  const nearby = useSyncExternalStore(subscribeBranch, getBranchSnapshot, getBranchServerSnapshot);
  const fallback = locations.find((l) => l.startsWith("Dhaka")) ?? locations[0] ?? "";
  const defaultLocation = nearby && locations.includes(nearby) ? nearby : fallback;
  // `null` means "not touched yet", so the geo default can arrive after
  // hydration without an effect writing state, and a visitor who has picked a
  // branch is never overridden by it.
  const [chosenPickup, setChosenPickup] = useState<string | null>(null);
  const pickupLocation = chosenPickup ?? defaultLocation;
  const setPickupLocation = setChosenPickup;
  const [pickupDate, setPickupDate] = useState(isoIn(3));
  const [pickupTime, setPickupTime] = useState("10:00");
  const [chosenDropoff, setChosenDropoff] = useState<string | null>(null);
  const dropoffLocation = chosenDropoff ?? defaultLocation;
  const setDropoffLocation = setChosenDropoff;
  const [dropoffDate, setDropoffDate] = useState(isoIn(6));
  const [dropoffTime, setDropoffTime] = useState("10:00");
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateNote, setLocateNote] = useState<string | null>(null);

  /**
   * Ask the browser where we are and pick the nearest branch.
   *
   * Sets both ends, because the overwhelming case is collecting and returning
   * at the same branch — and the drop-off is one click away if not. Every
   * failure is reported rather than swallowed: a visitor who taps this and
   * sees nothing happen has no way to know whether it worked.
   */
  function locate() {
    if (!("geolocation" in navigator)) {
      setLocateNote("This browser cannot share a location.");
      return;
    }

    setLocating(true);
    setLocateNote(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const branch = nearestBranch(position.coords.latitude, position.coords.longitude, locations);
        setPickupLocation(branch);
        setDropoffLocation(branch);
        setLocating(false);
        setLocateNote(`Nearest branch: ${branch}`);
      },
      (err) => {
        setLocating(false);
        // A browser will not prompt again once it has been refused, so saying
        // "denied" and nothing else leaves the visitor pressing a button that
        // can no longer work. Name where the switch is, and point at the
        // control that does work.
        setLocateNote(
          err.code === err.PERMISSION_DENIED
            ? "Location is blocked for this site — allow it in your browser's address bar, or just choose a branch."
            : "Could not read your location — choose a branch instead.",
        );
      },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 5 * 60_000 },
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (new Date(dropoffDate) <= new Date(pickupDate)) {
      setError("Drop-off has to be after pick-up.");
      return;
    }
    setError(null);
    const params = new URLSearchParams({
      location: pickupLocation,
      pickup: `${pickupDate}T${pickupTime}`,
      dropoff: `${dropoffDate}T${dropoffTime}`,
      dropoffLocation,
    });
    router.push(`/cars?${params.toString()}`);
  }

  const cell = "flex flex-col gap-1.5 px-5 py-4";
  const label = "text-[13px] font-semibold text-ink-900";
  const control =
    "w-full bg-transparent text-[13px] text-ink-500 outline-none focus-visible:text-ink-900 [color-scheme:light]";

  return (
    <form
      onSubmit={submit}
      className={cn(
        "rounded-2xl border border-line bg-white shadow-[0_28px_70px_-32px_rgba(9,44,76,0.35)]",
        className,
      )}
    >
      <div className="grid gap-px bg-line lg:grid-cols-[1fr_1fr_auto]">
        {/* Pick-up */}
        <div className="bg-white">
          <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
            <span className="grid size-4 place-items-center rounded-full border-[3px] border-brand-400" />
            <span className="text-[13px] font-semibold text-ink-900">Pick - Up</span>

            {/*
              The IP city can only ever answer "Dhaka", and five of our
              branches are in Dhaka — so someone standing in Uttara was opened
              on Gulshan. This asks the browser for a real fix and picks the
              branch nearest to it. Opt-in on purpose: a permission prompt
              nobody asked for is worse than a sensible default, so the
              preselected branch is already usable and this only sharpens it.
            */}
            <button
              type="button"
              onClick={locate}
              disabled={locating}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[12px] font-medium text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-900 disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" aria-hidden className="size-3.5 text-brand-400" fill="none" stroke="currentColor" strokeWidth="1.9">
                <circle cx="12" cy="12" r="3.2" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
              </svg>
              {locating ? "Locating…" : "Use my location"}
            </button>
            {locateNote && <span className="text-[12px] text-ink-400">{locateNote}</span>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3">
            <div className={cell}>
              <span className={label}>Locations</span>
              <select
                aria-label="Pick-up location"
                className={control}
                value={pickupLocation}
                onChange={(e) => setPickupLocation(e.target.value)}
              >
                {locations.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className={cn(cell, "sm:border-l sm:border-line")}>
              <span className={label}>Date</span>
              <input
                id={`${id}-pickup-date`}
                aria-label="Pick-up date"
                type="date"
                min={isoIn(0)}
                className={control}
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
              />
            </div>
            <div className={cn(cell, "sm:border-l sm:border-line")}>
              <span className={label}>Time</span>
              <select aria-label="Pick-up time" className={control} value={pickupTime} onChange={(e) => setPickupTime(e.target.value)}>
                {TIMES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Drop-off */}
        <div className="bg-white">
          <div className="flex items-center gap-2 px-5 pt-4">
            <span className="grid size-4 place-items-center rounded-full border-[3px] border-ink-300" />
            <span className="text-[13px] font-semibold text-ink-900">Drop - Off</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3">
            <div className={cell}>
              <span className={label}>Locations</span>
              <select
                aria-label="Drop-off location"
                className={control}
                value={dropoffLocation}
                onChange={(e) => setDropoffLocation(e.target.value)}
              >
                {locations.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className={cn(cell, "sm:border-l sm:border-line")}>
              <span className={label}>Date</span>
              <input
                aria-label="Drop-off date"
                type="date"
                min={pickupDate}
                className={control}
                value={dropoffDate}
                onChange={(e) => setDropoffDate(e.target.value)}
              />
            </div>
            <div className={cn(cell, "sm:border-l sm:border-line")}>
              <span className={label}>Time</span>
              <select aria-label="Drop-off time" className={control} value={dropoffTime} onChange={(e) => setDropoffTime(e.target.value)}>
                {TIMES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center bg-white p-3 lg:p-4">
          <button
            type="submit"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-400 px-8 text-sm font-semibold text-white shadow-[0_12px_26px_-12px_rgba(255,159,67,1)] transition-all hover:bg-brand-500 lg:w-auto"
          >
            <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="9" r="6" />
              <path d="m17 17-3.5-3.5" strokeLinecap="round" />
            </svg>
            Search
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="border-t border-line px-5 py-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
