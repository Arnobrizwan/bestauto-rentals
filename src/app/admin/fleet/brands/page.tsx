import type { Metadata } from "next";

import { CatalogueView } from "@/components/admin/catalogue-table";
import { getBrands } from "@/server/repositories/catalogue";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Brands" };

export default async function Page() {
  const rows = await getBrands();
  return (
    <CatalogueView
      title="Brands"
      subtitle="Reconditioned Japanese imports dominate the market; this is the split by marque"
      keyLabel="Brand"
      rows={rows}
      capitalise={false}
    />
  );
}
