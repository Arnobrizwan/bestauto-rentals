import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/table";
import { VehicleForm } from "@/components/admin/vehicle-form";
import { BRANCHES } from "@/server/repositories/vehicles";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Add vehicle" };

export default function NewVehiclePage() {
  return (
    <>
      <PageHeader
        title="Add vehicle"
        subtitle="A new model goes live on the public fleet immediately. Creating one requires an admin session — a viewer receives a 403 from the endpoint, not a hidden button."
      />
      <VehicleForm branches={BRANCHES} />
    </>
  );
}
