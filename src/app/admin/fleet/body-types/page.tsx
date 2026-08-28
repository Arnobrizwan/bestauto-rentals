import type { Metadata } from "next";

import { CatalogueView } from "@/components/admin/catalogue-table";
import { getBodyTypes } from "@/server/repositories/catalogue";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Body types" };

export default async function Page() {
  const rows = await getBodyTypes();
  return (
    <CatalogueView
      title="Body types"
      subtitle="Sedan, SUV, microbus and hatchback — the shape customers actually ask for"
      keyLabel="Body type"
      rows={rows}
      capitalise={false}
    />
  );
}
