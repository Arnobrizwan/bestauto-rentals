import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge, ButtonLink } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getBookingByReference } from "@/server/repositories/bookings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Booking confirmed", robots: { index: false } };

type Params = Promise<{ reference: string }>;

export default async function BookingConfirmationPage({ params }: { params: Params }) {
  const { reference } = await params;
  const row = await getBookingByReference(decodeURIComponent(reference));
  if (!row) notFound();

  const { booking, vehicle, customer } = row;

  const lines = [
    { label: "Reference", value: booking.reference },
    { label: "Collect from", value: booking.pickupLocation },
    { label: "Pick-up", value: formatDate(booking.pickupAt) },
    { label: "Drop-off", value: formatDate(booking.dropoffAt) },
    { label: "Duration", value: `${booking.days} ${booking.days === 1 ? "day" : "days"}` },
    { label: "Payment", value: booking.paymentMethod },
  ];

  return (
    <div className="bg-canvas pt-18">
      <div className="mx-auto max-w-3xl px-5 py-14 lg:py-20">
        <div className="rounded-3xl border border-line bg-white p-8 shadow-card lg:p-10">
          <span className="grid size-14 place-items-center rounded-2xl bg-success-soft text-success">
            <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>

          <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-ink-900 lg:text-4xl">
            You&apos;re booked, {customer.name.split(" ")[0]}.
          </h1>
          <p className="mt-3 text-[16px] leading-relaxed text-ink-400">
            A confirmation is on its way to {customer.email}. Bring your licence and the card you booked with — that&apos;s
            all you need at the counter.
          </p>

          <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-line bg-canvas p-4 sm:flex-row sm:items-center">
            <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-xl bg-ink-100 sm:w-44">
              <Image src={vehicle.imageUrl} alt={vehicle.name} fill sizes="200px" className="object-cover" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg font-semibold text-ink-900">{vehicle.name}</h2>
                <Badge tone="softSuccess" dot>
                  Confirmed
                </Badge>
              </div>
              <p className="mt-1 text-[13px] text-ink-400">
                {vehicle.seats} seats · {vehicle.transmission} · {vehicle.fuel}
              </p>
            </div>
          </div>

          <dl className="mt-8 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {lines.map((line) => (
              <div key={line.label} className="flex justify-between gap-3 border-b border-line pb-3">
                <dt className="text-[14px] text-ink-400">{line.label}</dt>
                <dd className="text-right text-[14px] font-semibold text-ink-900">{line.value}</dd>
              </div>
            ))}
          </dl>

          {booking.extras.length > 0 && (
            <div className="mt-6">
              <p className="text-[13px] font-semibold text-ink-700">Extras added</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {booking.extras.map((extra) => (
                  <Badge key={extra} tone="softWarning">
                    {extra}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 flex items-baseline justify-between border-t border-line pt-6">
            <span className="text-[15px] text-ink-400">Total paid</span>
            <span className="font-display text-3xl font-bold text-ink-900">{formatCurrency(Number(booking.total))}</span>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/cars" variant="dark">
              Browse more cars
            </ButtonLink>
            <ButtonLink href="/admin/bookings" variant="outline">
              See it in the dashboard
            </ButtonLink>
          </div>
        </div>

        <p className="mt-6 text-center text-[13px] text-ink-400">
          Need to change something?{" "}
          <Link href="/#matcher" className="font-semibold text-brand-500 hover:underline">
            Ask the concierge
          </Link>{" "}
          — amendments are free subject to availability.
        </p>
      </div>
    </div>
  );
}
