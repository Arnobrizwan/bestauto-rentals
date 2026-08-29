"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** How close to the top counts as arrived. */
const SETTLED_PX = 12;

/**
 * Scrolls to `#section` when the hash arrives with a route change.
 *
 * The browser handles an anchor on the page you are already on. It does not
 * handle one that comes with a navigation: clicking "Current deals" (`/#deals`)
 * from /privacy or /terms put `#deals` in the address bar and left you at the
 * top of the home page with nothing else happening. Every cross-page anchor in
 * the footer behaved this way, which reads as a dead link rather than a broken
 * one.
 *
 * Two things fight this, so scrolling once is not enough. The section is part
 * of the page subtree and streams in after the layout's effects run, so it may
 * not exist yet; and the router restores scroll to the top after we have moved,
 * putting us straight back where we started. The position is therefore
 * re-asserted on a short schedule until the target actually sits at the top,
 * then left alone — so a visitor who scrolls away during the attempt is not
 * dragged back.
 */
export function HashScroll() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];

    const attempt = () => {
      if (cancelled) return true;

      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return true;

      const target = document.getElementById(id);
      if (!target) return false;

      const top = target.getBoundingClientRect().top;
      if (Math.abs(top) <= SETTLED_PX) return true;

      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return false;
    };

    // Spread over ~1.5s: early tries catch a page that is already there, later
    // ones outlast both the streamed render and the router's scroll restore.
    for (const delay of [0, 80, 200, 400, 700, 1100, 1500]) {
      timers.push(window.setTimeout(() => void attempt(), delay));
    }

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [pathname]);

  return null;
}
