import type { Metadata } from "next";

import { CatalogueView } from "@/components/admin/catalogue-table";
import { getSegments } from "@/server/repositories/catalogue";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Segments" };

export default async function Page() {
  const rows = await getSegments();
  return (
    <CatalogueView
      title="Segments"
      subtitle="How the fleet splits across the four booking tiers, and what each tier earns"
      keyLabel="Segment"
      rows={rows}
      capitalise={true}
    />
  );
}
