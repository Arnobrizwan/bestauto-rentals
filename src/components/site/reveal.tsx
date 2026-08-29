"use client";

import { useEffect } from "react";

/**
 * Reveals `[data-reveal]` elements once as they enter the viewport.
 *
 * One observer for the whole page rather than a wrapper component per element,
 * so adding an animation to a section costs one attribute and no extra DOM.
 * Elements are visible by default under `prefers-reduced-motion` via CSS.
 *
 * It watches for the elements rather than looking for them once.
 *
 * This component is rendered by the site layout, and the layout's effect runs
 * before the page's own subtree is in the DOM — it sits outside that Suspense
 * boundary, so a single `querySelectorAll` at mount can and does return
 * nothing. The layout then never remounts across client-side navigation, so
 * that one empty scan was the only one that ever happened: every section on
 * the home page stayed at opacity 0, and arriving from /privacy or /terms gave
 * a page that looked slow and dead rather than obviously broken.
 *
 * A MutationObserver removes the timing question entirely. Nodes are picked up
 * whenever they appear — streamed in, hydrated late, or swapped in by the
 * router — so there is no moment this has to guess at and no pathname to
 * track. The first scan is deferred by a frame because setting `data-revealed`
 * on a node React has not hydrated yet is reported as a hydration mismatch.
 */
export function RevealOnScroll() {
  useEffect(() => {
    let cancelled = false;
    let intersection: IntersectionObserver | undefined;
    let mutation: MutationObserver | undefined;
    let failsafe: number | undefined;

    const query = () =>
      Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]")).filter(
        (n) => !n.hasAttribute("data-revealed"),
      );

    const reveal = (el: HTMLElement, delay = 0) => {
      window.setTimeout(() => el.setAttribute("data-revealed", "true"), delay);
    };

    const frame = requestAnimationFrame(() => {
      if (cancelled) return;

      // No animation wanted, and nothing to observe for: show everything now
      // and keep showing anything that arrives later.
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // No observer, no reveal — and the CSS starts these elements at opacity
      // 0, so without this the page is simply blank.
      const revealImmediately = reducedMotion || !("IntersectionObserver" in window);

      let anyRevealed = false;

      if (!revealImmediately) {
        intersection = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              const el = entry.target as HTMLElement;
              anyRevealed = true;
              reveal(el, Number(el.dataset.revealDelay ?? 0));
              intersection?.unobserve(el);
            }
          },
          { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
        );
      }

      // Already-revealed nodes are filtered out by `query`, so a rescan never
      // restarts an animation the visitor has already watched, and observing
      // the same element twice is a no-op in any case.
      const scan = () => {
        for (const node of query()) {
          if (revealImmediately) reveal(node);
          else intersection?.observe(node);
        }
      };

      scan();

      mutation = new MutationObserver(scan);
      mutation.observe(document.body, { childList: true, subtree: true });

      // Failsafe for contexts where the observer exists but never fires — an
      // iframe whose viewport never intersects the root is the one that bit us,
      // and it left How it works, the deals grid, Why choose us and the
      // testimonials permanently invisible. If nothing at all has been revealed
      // by now the observer is not working, so show everything rather than
      // animate nothing. A single reveal is enough to prove it does work, which
      // is why this checks the flag instead of unconditionally revealing.
      if (!revealImmediately) {
        failsafe = window.setTimeout(() => {
          if (!anyRevealed) query().forEach((n) => reveal(n));
        }, 1500);
      }
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (failsafe !== undefined) window.clearTimeout(failsafe);
      intersection?.disconnect();
      mutation?.disconnect();
    };
  }, []);

  return null;
}
