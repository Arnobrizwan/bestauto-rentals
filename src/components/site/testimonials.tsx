"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * One review as the home page renders it.
 *
 * These six used to be a literal array in this file, which made the social
 * proof on the public home page a deploy-only artefact: a misspelt name, or a
 * customer asking for their words to come down, meant a code change. They come
 * from the `testimonials` table now and the admin panel edits them.
 */
export type SiteTestimonial = {
  id: string;
  author: string;
  city: string;
  rating: number;
  body: string;
};

const PER_PAGE = 3;

export function Testimonials({ reviews }: { reviews: SiteTestimonial[] }) {
  const [page, setPage] = useState(0);
  // Never zero: it divides the carousel and guards the modulo in `go`.
  const pageCount = Math.max(1, Math.ceil(reviews.length / PER_PAGE));
  const trackRef = useRef<HTMLDivElement>(null);

  const go = useCallback(
    (next: number) => setPage(((next % pageCount) + pageCount) % pageCount),
    [pageCount],
  );

  // Advance on a timer, but never while the visitor is hovering or focused inside.
  useEffect(() => {
    const node = trackRef.current;
    if (!node) return;
    let paused = false;
    const onEnter = () => (paused = true);
    const onLeave = () => (paused = false);
    node.addEventListener("pointerenter", onEnter);
    node.addEventListener("pointerleave", onLeave);
    node.addEventListener("focusin", onEnter);
    node.addEventListener("focusout", onLeave);

    const timer = window.setInterval(() => {
      if (!paused) setPage((p) => (p + 1) % pageCount);
    }, 6500);

    return () => {
      window.clearInterval(timer);
      node.removeEventListener("pointerenter", onEnter);
      node.removeEventListener("pointerleave", onLeave);
      node.removeEventListener("focusin", onEnter);
      node.removeEventListener("focusout", onLeave);
    };
  }, [pageCount]);

  // Every review taken down leaves the section with nothing honest to say,
  // so it is omitted rather than rendered as an empty carousel.
  if (reviews.length === 0) return null;

  return (
    <section id="testimonials" className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <header className="mx-auto max-w-2xl text-center" data-reveal>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink-900 sm:text-[42px]">
            Trusted by Thousands of
            <br />
            Happy Customer
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-400">
            A high-performing web-based car rental system for any rent-a-car company and website.
          </p>
        </header>

        <div ref={trackRef} className="mt-14 overflow-hidden" data-reveal data-reveal-delay="80">
          <div
            className="flex transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ transform: `translateX(-${page * 100}%)` }}
          >
            {Array.from({ length: pageCount }, (_, p) => (
              <div key={p} className="grid w-full shrink-0 gap-5 px-0.5 md:grid-cols-3" aria-hidden={p !== page}>
                {reviews.slice(p * PER_PAGE, p * PER_PAGE + PER_PAGE).map((review) => (
                  <figure
                    key={review.id}
                    className="flex flex-col rounded-2xl border border-line bg-canvas p-6 transition-all hover:border-brand-200 hover:bg-white hover:shadow-lift"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <figcaption className="flex items-center gap-3">
                        <span className="grid size-11 place-items-center rounded-full bg-ink-900 font-display text-sm font-bold text-white">
                          {review.author
                            .split(" ")
                            .slice(0, 2)
                            .map((w) => w[0])
                            .join("")}
                        </span>
                        <span>
                          <span className="block font-display text-[15px] font-semibold text-ink-900">{review.author}</span>
                          <span className="block text-[13px] text-ink-400">{review.city}</span>
                        </span>
                      </figcaption>
                      <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-ink-900">
                        <svg viewBox="0 0 24 24" className="size-3.5 text-brand-400" fill="currentColor">
                          <path d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.6l1.1-6L3.4 9.4l6-.8z" />
                        </svg>
                        {review.rating}
                      </span>
                    </div>
                    <blockquote className="mt-5 text-[15px] leading-relaxed text-ink-500">
                      &ldquo;{review.body}&rdquo;
                    </blockquote>
                  </figure>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 flex items-center justify-between">
          <div className="flex items-center gap-2" role="tablist" aria-label="Testimonial pages">
            {Array.from({ length: pageCount }, (_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === page}
                aria-label={`Testimonials page ${i + 1}`}
                onClick={() => go(i)}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  i === page ? "w-8 bg-ink-900" : "w-2 bg-ink-200 hover:bg-ink-300",
                )}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => go(page - 1)}
              aria-label="Previous testimonials"
              className="grid size-11 place-items-center rounded-full border border-ink-200 text-ink-600 transition-all hover:border-ink-900 hover:bg-ink-900 hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M19 12H5m0 0 6-6m-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => go(page + 1)}
              aria-label="Next testimonials"
              className="grid size-11 place-items-center rounded-full border border-ink-200 text-ink-600 transition-all hover:border-ink-900 hover:bg-ink-900 hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M5 12h14m0 0-6-6m6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
