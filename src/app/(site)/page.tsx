import Image from "next/image";

import { AiMatcher } from "@/components/site/ai-matcher";
import { Deals } from "@/components/site/deals";
import { Offers } from "@/components/site/offers";
import { SearchPanel } from "@/components/site/search-panel";
import { HowItWorks, PromoPanels, WhyChooseUs } from "@/components/site/sections";
import { RegisterSection } from "@/components/site/register";
import { Testimonials } from "@/components/site/testimonials";
import type { VehicleCardData } from "@/components/site/vehicle-card";
import { ButtonLink } from "@/components/ui";
import { listPublicOffers } from "@/server/repositories/fleet-ops";
import { listFacets, listVehicles } from "@/server/repositories/vehicles";

/**
 * Rendered once and served from the CDN for five minutes.
 *
 * This page was `force-dynamic`, which meant every visitor waited for a round
 * trip to the function region — and the functions run beside the database in
 * `iad1` while most of this audience is served from `bom1`, so that round trip
 * was the page load. Nothing here is per-visitor: it is the fleet, and the
 * fleet does not change between two people opening the site a second apart.
 *
 * Availability shown on a card can therefore be up to five minutes stale, which
 * is safe because it was never authoritative: `POST /api/bookings` re-checks
 * availability against overlapping bookings before it accepts anything.
 * Publishing a vehicle revalidates this path immediately, so an operator does
 * not wait out the window.
 */
export const revalidate = 300;

/**
 * The headline figures, computed where they can be.
 *
 * "11 Branches" and "4.8 Average rating" were string literals sitting above a
 * fleet that could change underneath them: adding a branch or a car left the
 * banner quietly wrong, and a visitor has no way to tell a measured number
 * from a decorative one. Branch count and mean rating are now read from the
 * same data the rest of the page renders.
 *
 * The other two stay literal because they are policy, not data — the
 * concierge is available around the clock and cancellation is free for 24
 * hours, and neither is stored anywhere to be derived from.
 */
function trustStats(branches: number, rating: number, reviewed: number) {
  return [
    { value: String(branches), label: "Branches" },
    { value: "24/7", label: "AI concierge" },
    { value: "24h", label: "Free cancellation" },
    // Only claim an average once something has actually been rated.
    { value: reviewed > 0 ? rating.toFixed(1) : "New", label: "Average rating" },
  ];
}

export default async function HomePage() {
  const [{ items, total }, facets, offers] = await Promise.all([
    listVehicles({ sort: "popular", limit: 8 }),
    listFacets(),
    listPublicOffers(),
  ]);

  // Mean of the cars that actually carry a rating, so one unrated new arrival
  // cannot drag the headline figure down.
  const rated = items.filter((v) => v.reviewCount > 0);
  const reviewedCars = rated.length;
  const averageRating = reviewedCars ? rated.reduce((sum, v) => sum + v.rating, 0) / reviewedCars : 0;

  const deals: VehicleCardData[] = items.map((v) => ({
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
    unitsFree: v.unitsFree,
  }));

  return (
    <>
      {/* ------------------------------------------------------------ Hero */}
      <section className="relative overflow-hidden bg-canvas pt-18">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(48rem 28rem at 88% 8%, rgba(255,159,67,0.16), transparent 62%), radial-gradient(40rem 24rem at 4% 40%, rgba(9,44,76,0.06), transparent 60%)",
          }}
        />

        <div className="relative mx-auto max-w-7xl px-5 pt-14 lg:px-8 lg:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1.08fr_1fr] lg:gap-12">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-1.5 text-[13px] font-medium text-ink-500 shadow-card">
                <span className="size-1.5 rounded-full bg-success" />
                100% Trusted Car rental platform in Bangladesh
              </p>

              <h1 className="mt-6 font-display text-[38px] leading-[1.06] font-bold tracking-tight text-ink-900 uppercase sm:text-[52px] lg:text-[44px] xl:text-[54px]">
                Fast and easy way to
                <br />
                <span className="text-brand-400">rent a car</span>
              </h1>

              <p className="mt-6 max-w-lg text-[16px] leading-relaxed text-ink-400">
                Chauffeur-driven cars across Dhaka and eleven branches nationwide. Honest rates in taka, fuel billed at
                cost, and an assistant that checks real availability before it answers.
              </p>

              {/*
                Not flex-wrap: at 390px two large buttons wrapped onto separate
                rows with the row gap between them, which read as a layout
                accident rather than a stack. They share the row instead and
                only stop stretching once there is space for them to sit at
                their natural width.

                Both labels are nowrap for the same reason one row down: once
                the buttons share a 390px row each is narrow enough that
                "Booking Now" broke across two lines inside its own pill.
              */}
              <div className="mt-9 flex items-center gap-3">
                <ButtonLink href="/cars" size="lg" className="flex-1 justify-center whitespace-nowrap sm:flex-none">
                  Booking Now
                </ButtonLink>
                <ButtonLink
                  href="#deals"
                  variant="ghost"
                  size="lg"
                  className="flex-1 justify-center whitespace-nowrap sm:flex-none"
                >
                  See all cars
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M5 12h14m0 0-6-6m6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </ButtonLink>
              </div>

              <dl className="mt-12 grid max-w-lg grid-cols-2 gap-6 border-t border-line pt-8 sm:grid-cols-4">
                {trustStats(facets.locations.length, averageRating, reviewedCars).map((stat) => (
                  <div key={stat.label}>
                    <dt className="font-display text-2xl font-bold text-ink-900">{stat.value}</dt>
                    <dd className="mt-0.5 text-[13px] text-ink-400">{stat.label}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="relative">
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl rounded-tr-[80px] bg-ink-100 lg:aspect-[5/4]">
                <Image
                  src="https://images.unsplash.com/photo-1630826362226-a509049bcdbf"
                  alt="A Toyota Land Cruiser Prado from the Best Auto fleet"
                  fill
                  priority
                  sizes="(max-width: 1024px) 92vw, 52vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950/25 to-transparent" />
              </div>

              {/*
                The overhang is capped at the padding it has to overhang into.
                `sm:-left-6` pulls 24px left from 640px up, but the container
                only carries 20px of padding until `lg:px-8` at 1024px — so
                between roughly 640 and 1024 the badge sat 4px past the content
                edge and was clipped. The wider pull now waits for the wider
                padding.
              */}
              <div className="absolute -bottom-5 -left-3 flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 shadow-lift lg:-left-6">
                <span className="grid size-10 place-items-center rounded-xl bg-success-soft text-success">
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span>
                  <span className="block font-display text-sm font-semibold text-ink-900">{total} cars ready now</span>
                  <span className="block text-[12px] text-ink-400">Live availability, checked on every answer</span>
                </span>
              </div>
            </div>
          </div>

          <div className="pt-20 pb-16 lg:pt-24">
            <SearchPanel locations={facets.locations} />
          </div>
        </div>
      </section>

      <HowItWorks />
      <Deals initial={deals} initialTotal={total} />
      <Offers offers={offers} />
      <AiMatcher />
      <WhyChooseUs />
      <PromoPanels />
      <Testimonials />
      <RegisterSection />
    </>
  );
}
