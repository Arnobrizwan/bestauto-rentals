import Image from "next/image";
import Link from "next/link";

const STEPS = [
  {
    title: "Choose Location",
    body: "Pick from eleven branches across the UK, or have the car delivered to a terminal, a hotel or your front door.",
    icon: "M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  },
  {
    title: "Pick-up Date",
    body: "Set your dates and we hold the vehicle. Free cancellation up to 48 hours before you collect, no questions asked.",
    icon: "M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z M8 3v4M16 3v4M4 11h16",
  },
  {
    title: "Book your car",
    body: "Pay online, collect the keys, drive away. Everything is confirmed by email before you leave the page.",
    icon: "M4 15h16v3a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-.5h-9v.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z M5.5 15 7 9.6A2 2 0 0 1 8.9 8h6.2a2 2 0 0 1 1.9 1.6L18.5 15",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <header className="mx-auto max-w-2xl text-center" data-reveal>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink-900 sm:text-[42px]">
            How it works
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-400">
            A high-performing web-based car rental system for any rent-a-car company and website.
          </p>
        </header>

        <div className="relative mt-16">
          {/* The connecting curve from the wireframe, drawn once and hidden on
              small screens where the steps stack. */}
          <svg
            aria-hidden
            viewBox="0 0 1000 120"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-x-[16%] top-8 hidden h-24 w-[68%] lg:block"
          >
            <path
              d="M0 74 C 120 74, 150 12, 275 12 S 430 74, 500 74 S 640 12, 725 12 S 880 74, 1000 74"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-ink-200"
              strokeDasharray="4 6"
            />
          </svg>

          <ol className="relative grid gap-12 lg:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="text-center" data-reveal data-reveal-delay={i * 90}>
                <span className="mx-auto grid size-20 place-items-center rounded-2xl border border-line bg-canvas text-ink-700 transition-all duration-300 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-500">
                  <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d={step.icon} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <h3 className="mt-7 font-display text-xl font-semibold text-ink-900">{step.title}</h3>
                <p className="mx-auto mt-3 max-w-xs text-[15px] leading-relaxed text-ink-400">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

const REASONS = [
  {
    title: "Customer Support",
    body: "Extremely responsive customer support provided by the team at Best Auto UK — plus an AI concierge that answers the routine questions instantly, day or night.",
    icon: "M15.5 16.5 14 18a13.4 13.4 0 0 1-8-8l1.5-1.5a1.4 1.4 0 0 0 .3-1.6L6.5 4.2A1.4 1.4 0 0 0 5.2 3.4H3.4A1.4 1.4 0 0 0 2 4.9 17 17 0 0 0 19.1 22a1.4 1.4 0 0 0 1.5-1.4v-1.8a1.4 1.4 0 0 0-.8-1.3l-2.7-1.3a1.4 1.4 0 0 0-1.6.3Z",
  },
  {
    title: "Best Price Guaranteed",
    body: "Extremely best prices for all category people offered at Best Auto UK. Multi-day discounts apply automatically — 12% from a week, 25% from a month.",
    icon: "M20.6 13.4 12.4 21.6a2 2 0 0 1-2.8 0l-7.2-7.2a2 2 0 0 1-.6-1.4V4a2 2 0 0 1 2-2h9a2 2 0 0 1 1.4.6l6.4 6.4a2 2 0 0 1 0 2.8Z M7 7h.01",
  },
  {
    title: "Many Location",
    body: "Extremely the best location and available near the big cities. Eleven branches across the UK, with delivery within 20 miles of every one of them.",
    icon: "M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  },
];

export function WhyChooseUs() {
  return (
    <section id="why-us" className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <header className="mx-auto max-w-2xl text-center" data-reveal>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink-900 sm:text-[42px]">
            Why choose us
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-400">
            A high-performing web-based car rental system for any rent-a-car company and website.
          </p>
        </header>

        <div className="mt-14 grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div className="relative" data-reveal>
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-ink-100">
              <Image
                src="https://images.unsplash.com/photo-1502877338535-766e1452684a"
                alt="A BMW M4 Competition parked outside the Best Auto Canary Wharf branch"
                fill
                sizes="(max-width: 1024px) 90vw, 45vw"
                className="object-cover"
              />
            </div>
            <div className="absolute -right-3 -bottom-6 rounded-2xl border border-line bg-white px-6 py-5 shadow-lift sm:-right-6">
              <p className="font-display text-3xl font-bold text-ink-900">4.8</p>
              <p className="mt-0.5 text-[13px] text-ink-400">Average rating</p>
              <div className="mt-2 flex gap-0.5 text-brand-400">
                {Array.from({ length: 5 }, (_, i) => (
                  <svg key={i} viewBox="0 0 24 24" className="size-3.5" fill="currentColor">
                    <path d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.6l1.1-6L3.4 9.4l6-.8z" />
                  </svg>
                ))}
              </div>
            </div>
          </div>

          <ul className="space-y-8">
            {REASONS.map((reason, i) => (
              <li key={reason.title} className="flex gap-5" data-reveal data-reveal-delay={i * 90}>
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-500">
                  <svg viewBox="0 0 24 24" className="size-5.5" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d={reason.icon} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold text-ink-900">{reason.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-400">{reason.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** The two promo panels that sit below "Why choose us" in the wireframe. */
export function PromoPanels() {
  return (
    <section className="bg-canvas py-4 pb-20 lg:pb-28">
      <div className="mx-auto grid max-w-7xl gap-5 px-5 md:grid-cols-2 lg:px-8">
        <article
          className="relative flex min-h-[300px] flex-col justify-between overflow-hidden rounded-3xl bg-ink-900 p-8 text-white lg:p-10"
          data-reveal
        >
          <div
            aria-hidden
            className="absolute inset-0 opacity-70"
            style={{ backgroundImage: "radial-gradient(34rem 20rem at 100% 0%, rgba(255,159,67,0.28), transparent 65%)" }}
          />
          <div className="relative">
            <span className="text-xs font-semibold tracking-[0.16em] text-brand-300 uppercase">Corporate accounts</span>
            <h3 className="mt-4 max-w-sm font-display text-2xl font-semibold lg:text-3xl">
              Three cars or more? Get invoiced monthly.
            </h3>
            <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-white/60">
              Thirty-day terms, one consolidated invoice, and a named account manager. Set up takes a short credit check
              and about a day.
            </p>
          </div>
          <Link
            href="/#contact"
            className="relative mt-8 inline-flex h-11 w-fit items-center rounded-full bg-white px-6 text-sm font-semibold text-ink-900 transition-colors hover:bg-brand-400 hover:text-ink-950"
          >
            Talk to us
          </Link>
        </article>

        <article
          className="relative flex min-h-[300px] flex-col justify-between overflow-hidden rounded-3xl border border-line bg-white p-8 lg:p-10"
          data-reveal
          data-reveal-delay="80"
        >
          <div className="relative">
            <span className="text-xs font-semibold tracking-[0.16em] text-brand-500 uppercase">Long rentals</span>
            <h3 className="mt-4 max-w-sm font-display text-2xl font-semibold text-ink-900 lg:text-3xl">
              The longer you keep it, the less it costs.
            </h3>
            <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-ink-400">
              Discounts apply automatically at checkout — no code, no haggling. You always see the discounted total
              before you pay.
            </p>
          </div>
          <dl className="relative mt-8 grid grid-cols-4 gap-2">
            {[
              { d: "3+ days", v: "5%" },
              { d: "7+ days", v: "12%" },
              { d: "14+ days", v: "18%" },
              { d: "28+ days", v: "25%" },
            ].map((tier) => (
              <div key={tier.d} className="rounded-xl bg-canvas px-2 py-3 text-center">
                <dt className="text-[11px] text-ink-400">{tier.d}</dt>
                <dd className="mt-0.5 font-display text-lg font-bold text-brand-500">{tier.v}</dd>
              </div>
            ))}
          </dl>
        </article>
      </div>
    </section>
  );
}
