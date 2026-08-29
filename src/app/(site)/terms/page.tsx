import type { Metadata } from "next";
import Link from "next/link";

import { KNOWLEDGE } from "@/ai/tools/knowledge";

export const metadata: Metadata = {
  title: "Rental terms & conditions",
  description: "The hire terms for Best Auto — driver, licence, deposit, fuel, cancellation, mileage and payment.",
};

/**
 * The hire terms, rendered from the concierge's own policy corpus.
 *
 * Written out by hand this page would be a second copy of the rules, free to
 * drift from what the assistant tells a customer — and the assistant is the
 * one people actually ask. Both read `KNOWLEDGE`, so the page and the answer
 * cannot disagree, and adding a policy publishes it in both places at once.
 */
export default function TermsPage() {
  return (
    <section className="mx-auto max-w-3xl px-5 py-16 lg:px-8 lg:py-24">
      <h1 className="font-display text-[34px] leading-tight font-bold tracking-tight text-ink-900 uppercase sm:text-[44px]">
        Rental terms &amp; conditions
      </h1>
      <div className="mt-12 space-y-9">
        {KNOWLEDGE.map((entry) => (
          <article key={entry.topic} id={entry.topic} className="scroll-mt-24 border-t border-line pt-7">
            <h2 className="font-display text-[19px] font-semibold text-ink-900">{entry.title}</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-500">{entry.body}</p>
          </article>
        ))}
      </div>

      <p className="mt-14 border-t border-line pt-7 text-[15px] leading-relaxed text-ink-400">
        A booking confirmation carries the terms that applied on the day it was made. Questions about a specific hire are
        best asked with your reference to hand —{" "}
        <Link href="/#register" className="font-semibold text-brand-500 hover:underline">
          get in touch
        </Link>
        .
      </p>
    </section>
  );
}
