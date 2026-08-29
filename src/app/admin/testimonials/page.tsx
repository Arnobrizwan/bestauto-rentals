import type { Metadata } from "next";

import { DataTable } from "@/components/admin/data-table";
import { StatRow } from "@/components/admin/stat-row";
import { PageHeader } from "@/components/admin/table";
import { TestimonialManager, TestimonialRow } from "@/components/admin/testimonial-manager";
import { formatNumber } from "@/lib/utils";
import { listTestimonials } from "@/server/repositories/testimonials";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Testimonials" };

/**
 * The reviews on the public home page.
 *
 * They were a hardcoded array inside the component that rendered them: six
 * names, cities and star ratings that no one at Best Auto could change,
 * correct or take down without a developer and a deploy — on the section that
 * sits above the fold on the busiest page the business has.
 */
export default async function TestimonialsPage() {
  const rows = await listTestimonials();
  const live = rows.filter((t) => t.active);
  const average = live.length ? live.reduce((sum, t) => sum + t.rating, 0) / live.length : 0;

  return (
    <>
      <PageHeader
        title="Testimonials"
        subtitle="What customers said, as shown in the carousel on the home page. Publishing, editing or hiding one takes effect on the public site immediately."
      />

      <TestimonialManager />

      <StatRow
        stats={[
          { label: "On the home page", value: formatNumber(live.length), tone: live.length ? "success" : "warning" },
          { label: "Hidden", value: formatNumber(rows.length - live.length) },
          { label: "Average shown", value: live.length ? `${average.toFixed(1)} ★` : "—" },
          { label: "On file", value: formatNumber(rows.length) },
        ]}
      />

      <DataTable
        rowCount={rows.length}
        minWidth={1040}
        columns={[
          { label: "Customer" },
          { label: "Review" },
          { label: "Car" },
          { label: "Rating", align: "right" },
          { label: "Status", align: "right" },
          { label: "Actions", align: "right" },
        ]}
        empty={{
          title: "No testimonials",
          detail: "The home page hides the section entirely until one is published.",
        }}
      >
        {rows.map((t) => (
          <TestimonialRow key={t.id} testimonial={t} />
        ))}
      </DataTable>
    </>
  );
}
