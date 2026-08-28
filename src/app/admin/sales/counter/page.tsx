import type { Metadata } from "next";

import { CounterForm } from "@/components/admin/counter-form";
import { PageHeader } from "@/components/admin/table";
import { BRANCHES } from "@/server/repositories/vehicles";
import { listVehiclesBasic } from "@/server/repositories/catalogue";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Counter booking" };

export default async function CounterPage() {
  const fleet = await listVehiclesBasic();

  const vehicles = fleet.map((v) => ({
    slug: v.slug,
    name: v.name,
    pricePerDay: Number(v.pricePerDay),
    seats: v.seats,
  }));

  return (
    <>
      <PageHeader
        title="Counter booking"
        subtitle="Take a walk-in booking at the desk. It goes through the same endpoint as the public site, so the price is recomputed server-side, availability is checked against overlapping hires, and the confirmation automation fires."
      />
      <CounterForm vehicles={vehicles} branches={BRANCHES} />
    </>
  );
}
