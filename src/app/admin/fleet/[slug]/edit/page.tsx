import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/table";
import { VehicleEditForm } from "@/components/admin/vehicle-edit";
import { BODY_TYPES } from "@/lib/taxonomy";
import { BRANCHES, getVehicleBySlug, listFacets } from "@/server/repositories/vehicles";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit vehicle" };

export default async function EditVehiclePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [vehicle, facets] = await Promise.all([getVehicleBySlug(slug), listFacets()]);
  if (!vehicle) notFound();

  const bodyTypes = [...new Set([...BODY_TYPES, ...facets.bodyTypes])].sort();

  return (
    <>
      <PageHeader
        title={`Edit ${vehicle.name}`}
        subtitle="Changes go live on the public site immediately — the pages this car appears on are revalidated on save, rather than waiting out their five-minute cache."
      />
      <VehicleEditForm
        vehicle={{
          slug: vehicle.slug,
          name: vehicle.name,
          segment: vehicle.segment,
          bodyType: vehicle.bodyType,
          transmission: vehicle.transmission,
          fuel: vehicle.fuel,
          pricePerDay: Number(vehicle.pricePerDay),
          costPerDay: Number(vehicle.costPerDay),
          location: vehicle.location,
          unitsTotal: vehicle.unitsTotal,
          unitsAvailable: vehicle.unitsAvailable,
        }}
        branches={BRANCHES}
        bodyTypes={bodyTypes}
      />
    </>
  );
}
