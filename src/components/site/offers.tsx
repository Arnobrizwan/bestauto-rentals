import { formatCurrency } from "@/lib/utils";

export type PublicOffer = {
  code: string;
  description: string;
  kind: string;
  value: number;
  minDays: number;
  daysLeft: number;
};

/**
 * The live discount codes, where a customer can actually find them.
 *
 * Seven codes were live and the only place they appeared was the operations
 * dashboard. The booking form had a box to type a code into and nothing that
 * told a visitor a code existed, so every offer reached only the people who
 * had been told about it somewhere else — the discounts were real, funded and
 * invisible.
 *
 * Rendered from the same validity test the checkout applies, so this can never
 * advertise a code that would then be refused. Usage limits and redemption
 * counts stay in the dashboard: a customer does not need to know that 45 of
 * 200 have gone, and publishing it only invites a rush.
 */
export function Offers({ offers }: { offers: PublicOffer[] }) {
  if (!offers.length) return null;

  return (
    <section id="offers" className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <header className="mx-auto max-w-2xl text-center" data-reveal>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink-900 sm:text-[42px]">
            Current offers
          </h2>
          <p className="mt-3 text-[16px] leading-relaxed text-ink-400">
            Add the code at checkout. Every one below is live today — no sign-up, no newsletter.
          </p>
        </header>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer) => (
            <li
              key={offer.code}
              className="flex flex-col rounded-2xl border border-line bg-canvas p-5 transition-shadow hover:shadow-card"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-lg border border-dashed border-brand-300 bg-white px-2.5 py-1 font-mono text-[13px] font-bold tracking-wide text-ink-900">
                  {offer.code}
                </span>
                <span className="font-display text-[19px] font-bold text-brand-500">
                  {offer.kind === "percent" ? `${offer.value}%` : formatCurrency(offer.value)}
                </span>
              </div>

              <p className="mt-3 flex-1 text-[14px] leading-relaxed text-ink-500">{offer.description}</p>

              <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-400">
                <span>{offer.minDays > 1 ? `${offer.minDays} days or more` : "Any booking"}</span>
                <span aria-hidden>·</span>
                {/* Countdown rather than a date: "ends in 6 days" is the thing
                    a customer acts on, and it needs no locale formatting to
                    stay identical on the server and the client. */}
                <span className={offer.daysLeft <= 7 ? "font-semibold text-danger" : undefined}>
                  {offer.daysLeft <= 0
                    ? "Ends today"
                    : offer.daysLeft === 1
                      ? "Ends tomorrow"
                      : `Ends in ${offer.daysLeft} days`}
                </span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
