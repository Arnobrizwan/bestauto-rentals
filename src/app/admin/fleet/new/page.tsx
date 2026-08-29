import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/table";
import { VehicleForm } from "@/components/admin/vehicle-form";
import { BODY_TYPES } from "@/lib/taxonomy";
import { BRANCHES, listFacets } from "@/server/repositories/vehicles";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Add vehicle" };

export default async function NewVehiclePage() {
  // Body type is free text on the vehicle, so the dropdown is the canonical
  // list unioned with whatever the fleet already runs — the same treatment
  // `listFacets` gives locations. A body type someone added last week is
  // offered here rather than being unreachable until the constant is edited.
  const facets = await listFacets();
  const bodyTypes = [...new Set([...BODY_TYPES, ...facets.bodyTypes])].sort();

  return (
    <>
      <PageHeader
        title="Add vehicle"
        subtitle="A new model goes live on the public fleet immediately. Creating one requires an admin session — a viewer receives a 403 from the endpoint, not a hidden button."
      />
      <VehicleForm branches={BRANCHES} bodyTypes={bodyTypes} />
    </>
  );
}
