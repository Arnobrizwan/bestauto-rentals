"use client";

import { useEffect } from "react";

/**
 * Reveals `[data-reveal]` elements once as they enter the viewport.
 *
 * One observer for the whole page rather than a wrapper component per element,
 * so adding an animation to a section costs one attribute and no extra DOM.
 * Elements are visible by default under `prefers-reduced-motion` via CSS.
 */
export function RevealOnScroll() {
  useEffect(() => {
    let cancelled = false;
    const cleanups: (() => void)[] = [];

    /**
     * Waits for hydration to finish before touching anything.
     *
     * This component is rendered by the site layout, which is outside the
     * page's own Suspense boundary, so its effect fires while the streamed
     * page subtree can still be hydrating. Setting `data-revealed` on a node
     * React has not hydrated yet is an attribute the server HTML does not
     * carry, and React reports every one of them as a hydration mismatch —
     * the home page logged one per revealed section. Deferring past `load`
     * and a frame puts the mutation after hydration has committed.
     */
    const whenHydrated = (run: () => void) => {
      const go = () => requestAnimationFrame(() => !cancelled && run());
      if (document.readyState === "complete") {
        go();
        return;
      }
      window.addEventListener("load", go, { once: true });
      cleanups.push(() => window.removeEventListener("load", go));
    };

    whenHydrated(() => {
      const nodes = Array.from(
        document.querySelectorAll<HTMLElement>("[data-reveal]"),
      );
      if (!nodes.length) return;

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        nodes.forEach((n) => n.setAttribute("data-revealed", "true"));
        return;
      }

      const revealAll = () =>
        nodes.forEach((n) => n.setAttribute("data-revealed", "true"));

      // No observer, no reveal — and the CSS starts these elements at opacity 0,
      // so without this the page is simply blank.
      if (!("IntersectionObserver" in window)) {
        revealAll();
        return;
      }

      let anyRevealed = false;

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const el = entry.target as HTMLElement;
            const delay = Number(el.dataset.revealDelay ?? 0);
            anyRevealed = true;
            window.setTimeout(
              () => el.setAttribute("data-revealed", "true"),
              delay,
            );
            observer.unobserve(el);
          }
        },
        { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
      );

      nodes.forEach((n) => observer.observe(n));

      // Failsafe for contexts where the observer exists but never fires — an
      // iframe whose viewport never intersects the root is the one that bit us,
      // and it left How it works, the deals grid, Why choose us and the
      // testimonials permanently invisible. If nothing at all has been revealed
      // by now the observer is not working, so show everything rather than
      // animate nothing. A single reveal is enough to prove it does work, which
      // is why this checks the flag instead of unconditionally revealing.
      const failsafe = window.setTimeout(() => {
        if (!anyRevealed) revealAll();
      }, 1200);

      cleanups.push(() => {
        window.clearTimeout(failsafe);
        observer.disconnect();
      });
    });

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return null;
}
