"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Scrolls to `#section` when the hash arrives with a route change.
 *
 * The browser handles an anchor on the page you are already on. It does not
 * handle one that comes with a navigation: clicking "Current deals" (`/#deals`)
 * from /privacy or /terms took you to the top of the home page with `#deals` in
 * the address bar and nothing else happening — the router restores scroll to
 * the top, and by the time the section exists the browser has long since given
 * up looking for it. Every cross-page anchor in the footer behaved this way,
 * which reads as a dead link rather than a broken one.
 *
 * The target is polled briefly rather than read once, because the section is
 * part of the page subtree and streams in after this effect runs.
 */
export function HashScroll() {
  const pathname = usePathname();

  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;

    let attempts = 0;
    let timer: number | undefined;

    const tick = () => {
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      // ~2s of grace, then give up rather than scroll something unrelated.
      if (attempts++ < 20) timer = window.setTimeout(tick, 100);
    };

    tick();

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [pathname]);

  return null;
}
