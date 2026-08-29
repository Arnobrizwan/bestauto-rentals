import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What Best Auto stores when you book, enquire or talk to the assistant, and why.",
};

/**
 * What the system actually stores.
 *
 * Deliberately a description of this codebase rather than generic policy
 * boilerplate: every claim below is checkable against `src/server/db/schema.ts`
 * and the routes that write to it. A privacy page that promises something the
 * code does not do is worse than none.
 */
const SECTIONS = [
  {
    title: "When you make a booking",
    body: "Your name, email address, phone number and city are stored against the booking, together with the vehicle, the branch, the dates, the price breakdown and the payment method you chose. The reference on your confirmation is how that record is looked up.",
  },
  {
    title: "When you send an enquiry",
    body: "The contact form and the assistant both create a lead: your name, email, optional phone and company, the message itself, and the budget, timeframe and party size where you mention them. Leads are scored so the sales team knows which to call first; the score and its reasoning are stored alongside.",
  },
  {
    title: "When you talk to the assistant",
    body: "Conversations are kept as transcripts so an operator can see what was promised and pick up where the assistant left off. A transcript holds the messages, which tools ran, and how long each answer took. It is linked to a session, not to your identity, unless you give contact details in the conversation.",
  },
  {
    title: "Payments",
    body: "No card or mobile-wallet credentials are collected or stored anywhere in this system. A booking records only which method you intend to pay by; the payment itself is settled at the counter or through the provider.",
  },
  {
    title: "Cookies",
    body: "One cookie, and only for staff: a signed session for the operations dashboard. There is no advertising, analytics or third-party tracking cookie on this site, so browsing the fleet sets nothing at all.",
  },
  {
    title: "Sharing and retention",
    body: "Your details go to the branch handling your hire and nowhere else — they are not sold, and not passed to advertisers. Booking records are kept as long as the business needs them for accounting; a lead or a transcript can be removed on request.",
  },
];

export default function PrivacyPage() {
  return (
    <section className="mx-auto max-w-3xl px-5 py-16 lg:px-8 lg:py-24">
      <h1 className="font-display text-[34px] leading-tight font-bold tracking-tight text-ink-900 uppercase sm:text-[44px]">
        Privacy policy
      </h1>
      <p className="mt-5 text-[16px] leading-relaxed text-ink-400">
        What Best Auto stores when you book a car, send an enquiry or talk to the assistant, why it is stored, and who
        sees it. Written in plain terms rather than legal ones.
      </p>

      <div className="mt-12 space-y-9">
        {SECTIONS.map((section) => (
          <article key={section.title} className="border-t border-line pt-7">
            <h2 className="font-display text-[19px] font-semibold text-ink-900">{section.title}</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-500">{section.body}</p>
          </article>
        ))}
      </div>

      <p className="mt-14 border-t border-line pt-7 text-[15px] leading-relaxed text-ink-400">
        To see, correct or delete what is held about you, ask through the{" "}
        <Link href="/#register" className="font-semibold text-brand-500 hover:underline">
          contact form
        </Link>{" "}
        with the email address you booked under. The hire terms themselves are on the{" "}
        <Link href="/terms" className="font-semibold text-brand-500 hover:underline">
          terms page
        </Link>
        .
      </p>
    </section>
  );
}
