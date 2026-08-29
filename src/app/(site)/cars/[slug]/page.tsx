import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BookingForm } from "@/components/site/booking-form";
import { VehicleCard, type VehicleCardData } from "@/components/site/vehicle-card";
import { Badge } from "@/components/ui";
import { DRIVER_NIGHT_ALLOWANCE, cityOfBranch, intercityQuotesFrom } from "@/lib/intercity";
import { formatCurrency } from "@/lib/utils";
import { getVehicleBySlug, listFacets, listVehicles } from "@/server/repositories/vehicles";

/**
 * Prerendered per vehicle and revalidated every five minutes.
 *
 * There are twelve models and no per-visitor content on the page, so serving
 * this from the edge rather than rendering it in `iad1` on every request
 * removes an intercontinental round trip from the most-visited page after the
 * home page. The booking form is a client component and still prices against
 * the live server on submit.
 */
export const revalidate = 300;

/**
 * Prebuild all twelve at deploy time; anything new renders on first request.
 *
 * An empty list is a valid answer, not a failure: it means nothing is
 * prerendered and every page is built on first request and then cached, which
 * costs one slow visit. Letting a database blip throw here instead would fail
 * the whole deployment — belt and braces alongside the client's retry, because
 * a deploy that cannot ship is worse than a page that is briefly slow.
 */
export async function generateStaticParams() {
  try {
    const { items } = await listVehicles({ limit: 100 });
    return items.map((v) => ({ slug: v.slug }));
  } catch {
    return [];
  }
}

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const vehicle = await getVehicleBySlug(slug);
  if (!vehicle) return { title: "Car not found" };
  return {
    title: vehicle.name,
    description: vehicle.description,
    openGraph: { title: vehicle.name, description: vehicle.description, images: [vehicle.imageUrl] },
  };
}

const SPECS = [
  { key: "seats", label: "Seats", icon: "M7 11V7a5 5 0 0 1 10 0v4m-11 0h12a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1Z" },
  { key: "transmission", label: "Gearbox", icon: "M12 3v6m0 0-2.5 2.5M12 9l2.5 2.5M6 15h12M8 21h8" },
  { key: "fuel", label: "Fuel", icon: "M5 21V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v16M4 21h12M14 9h3a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0V9l-2.5-2.5" },
  { key: "bags", label: "Luggage", icon: "M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-11 0h14a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" },
  { key: "doors", label: "Doors", icon: "M5 3h11a1 1 0 0 1 1 1v17H5zM17 8h2l1 5v8h-3M9 12h.01" },
  { key: "co2", label: "CO2", icon: "M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0M8 12h8M12 8v8" },
] as const;

export default async function VehiclePage({ params }: { params: Params }) {
  const { slug } = await params;
  const vehicle = await getVehicleBySlug(slug);
  if (!vehicle) notFound();

  const [facets, related] = await Promise.all([
    listFacets(),
    listVehicles({ segment: vehicle.segment, limit: 4 }),
  ]);

  const others: VehicleCardData[] = related.items
    .filter((v) => v.slug !== vehicle.slug)
    .slice(0, 3)
    .map((v) => ({
      slug: v.slug,
      name: v.name,
      brand: v.brand,
      bodyType: v.bodyType,
      transmission: v.transmission,
      fuel: v.fuel,
      seats: v.seats,
      bags: v.bags,
      pricePerDay: Number(v.pricePerDay),
      imageUrl: v.imageUrl,
      rating: v.rating,
      reviewCount: v.reviewCount,
      segment: v.segment,
      location: v.location,
      unitsAvailable: v.unitsAvailable,
    }));

  const specValues: Record<string, string> = {
    seats: `${vehicle.seats}`,
    transmission: vehicle.transmission,
    fuel: vehicle.fuel,
    bags: `${vehicle.bags}`,
    doors: `${vehicle.doors}`,
    co2: `${vehicle.co2} g/km`,
  };

  return (
    <div className="bg-canvas pt-18">
      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-14">
        <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-[13px] text-ink-400">
          <Link href="/" className="hover:text-ink-900">
            Home
          </Link>
          <span aria-hidden>/</span>
          <Link href="/cars" className="hover:text-ink-900">
            Rental deals
          </Link>
          <span aria-hidden>/</span>
          <span className="text-ink-900">{vehicle.name}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[1.55fr_1fr] lg:gap-12">
          <div>
            <div className="relative aspect-[16/10] overflow-hidden rounded-3xl bg-ink-100">
              <Image
                src={vehicle.imageUrl}
                alt={vehicle.name}
                fill
                priority
                sizes="(max-width: 1024px) 92vw, 60vw"
                className="object-cover"
              />
              <div className="absolute top-4 left-4 flex gap-2">
                <Badge tone="warning">{vehicle.segment === "exclusive" ? "Exclusive" : vehicle.bodyType}</Badge>
                {vehicle.unitsAvailable <= 1 && <Badge tone="danger">Last one available</Badge>}
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900 lg:text-[40px]">
                  {vehicle.name}
                </h1>
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-ink-400">
                  <span>{vehicle.year}</span>
                  <span aria-hidden>·</span>
                  <span>{vehicle.location}</span>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-ink-900">
                    <svg viewBox="0 0 24 24" className="size-4 text-brand-400" fill="currentColor">
                      <path d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.6l1.1-6L3.4 9.4l6-.8z" />
                    </svg>
                    {vehicle.reviewCount > 0 ? vehicle.rating.toFixed(1) : "New"}
                  </span>
                  <span className="text-ink-400">
                    {vehicle.reviewCount > 0 ? `(${vehicle.reviewCount} reviews)` : "(no reviews yet)"}
                  </span>
                </p>
              </div>
              <p className="font-display text-2xl font-bold text-brand-500">
                {formatCurrency(Number(vehicle.pricePerDay))}
                <span className="text-sm font-medium text-ink-400"> / day</span>
              </p>
            </div>

            <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-ink-500">{vehicle.description}</p>

            <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {SPECS.map((spec) => (
                <div key={spec.key} className="rounded-2xl border border-line bg-white px-4 py-4">
                  <dt className="flex items-center gap-2 text-[13px] text-ink-400">
                    <svg viewBox="0 0 24 24" className="size-4 text-ink-300" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d={spec.icon} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {spec.label}
                  </dt>
                  <dd className="mt-1.5 font-display text-lg font-semibold text-ink-900">{specValues[spec.key]}</dd>
                </div>
              ))}
            </dl>

            <section className="mt-10">
              <h2 className="font-display text-xl font-semibold text-ink-900">What&apos;s included</h2>
              <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {[...vehicle.features, "120km per day in Dhaka", "24/7 roadside support", "VAT challan included"].map((feature) => (
                  <li key={feature} className="flex items-center gap-2.5 text-[15px] text-ink-500">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-success-soft text-success">
                      <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-10 rounded-2xl border border-line bg-white p-6">
              <h2 className="font-display text-lg font-semibold text-ink-900">Good to know</h2>
              <dl className="mt-4 space-y-3 text-[15px]">
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-semibold text-ink-700">Deposit</dt>
                  <dd className="text-ink-400">
                    {vehicle.segment === "exclusive" ? "৳1,00,000" : vehicle.segment === "large" ? "৳25,000" : "৳10,000"}{" "}
                    refundable, returned within 3 working days by bKash, Nagad or bank transfer.
                  </dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-semibold text-ink-700">Documents</dt>
                  <dd className="text-ink-400">
                    Chauffeur-driven needs only an NID or passport. Self-drive requires 23+ and a BRTA licence held two
                    years.
                  </dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-semibold text-ink-700">Fuel policy</dt>
                  <dd className="text-ink-400">Billed at actual cost with pump receipts, on top of the daily rate.</dd>
                </div>
              </dl>
            </section>

            {/*
              The fixed intercity rates the policy has always promised.
              "Dhaka to Cox's Bazar, Sylhet or Chattogram each have a fixed
              round-trip rate" was in the corpus with no rate anywhere in the
              codebase behind it, so the assistant repeated the promise and
              then had to ask people to call. Each figure is this car's own day
              rate against the published 120km allowance, so it cannot drift
              away from the price printed at the top of the page.
            */}
            <section className="mt-12">
              <h2 className="font-display text-2xl font-semibold tracking-tight text-ink-900">
                Fixed intercity round trips
              </h2>
              <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-400">
                Return trips from {cityOfBranch(vehicle.location)} in this car, driver included. Each is priced on the
                120km a day your hire covers, plus {formatCurrency(DRIVER_NIGHT_ALLOWANCE)} a night for the
                driver&apos;s food and accommodation. Fuel and tolls are billed at cost.
              </p>

              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left">
                  <thead>
                    <tr className="border-b border-line text-[13px] text-ink-400">
                      <th className="pb-3 font-medium">Destination</th>
                      <th className="pb-3 font-medium">Return distance</th>
                      <th className="pb-3 font-medium">Billed as</th>
                      <th className="pb-3 text-right font-medium">Fixed rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {intercityQuotesFrom(Number(vehicle.pricePerDay), cityOfBranch(vehicle.location)).map((q) => (
                      <tr key={q.to}>
                        <td className="py-3.5">
                          <span className="font-display text-[15px] font-semibold text-ink-900">{q.to}</span>
                          {q.note && <span className="block text-[12px] text-ink-400">{q.note}</span>}
                        </td>
                        <td className="py-3.5 text-[14px] text-ink-500">
                          {q.roundTripKm} km
                          {q.estimated && <span className="ml-1 text-ink-300">approx.</span>}
                        </td>
                        <td className="py-3.5 text-[14px] text-ink-500">
                          {q.billableDays} days
                          {q.nights > 0 ? ` · ${q.nights} nights` : ""}
                        </td>
                        <td className="py-3.5 text-right font-display text-[15px] font-bold text-ink-900">
                          {formatCurrency(q.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <BookingForm
              slug={vehicle.slug}
              name={vehicle.name}
              pricePerDay={Number(vehicle.pricePerDay)}
              locations={facets.locations}
              defaultLocation={vehicle.location}
            />
          </div>
        </div>

        {others.length > 0 && (
          <section className="mt-20">
            <div className="mb-6 flex items-end justify-between gap-4">
              <h2 className="font-display text-2xl font-semibold text-ink-900">Similar cars</h2>
              <Link href="/cars" className="text-sm font-semibold text-brand-500 hover:underline">
                See the whole fleet
              </Link>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((v) => (
                <VehicleCard key={v.slug} vehicle={v} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
