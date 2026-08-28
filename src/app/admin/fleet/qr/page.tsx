import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/table";
import { StatRow } from "@/components/admin/stat-row";
import { Card } from "@/components/ui";
import { qrSvgPath } from "@/lib/qr";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { listVehiclesBasic } from "@/server/repositories/catalogue";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vehicle QR" };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bestauto-rentals.vercel.app";

function QrCode({ value, size = 116 }: { value: string; size?: number }) {
  const { d, size: modules } = qrSvgPath(value);
  return (
    <svg
      viewBox={`0 0 ${modules} ${modules}`}
      width={size}
      height={size}
      role="img"
      aria-label={`QR code for ${value}`}
      shapeRendering="crispEdges"
      className="shrink-0"
    >
      <rect width={modules} height={modules} fill="#fff" />
      <path d={d} fill="#092c4c" />
    </svg>
  );
}

export default async function QrPage() {
  const fleet = await listVehiclesBasic();

  return (
    <>
      <PageHeader
        title="Vehicle QR"
        subtitle="A printable code per model, pointing at its public booking page. Stick one in the windscreen and a walk-up customer books the car they are standing next to."
      />

      <StatRow
        stats={[
          { label: "Codes on this sheet", value: formatNumber(fleet.length) },
          { label: "Encoding", value: "QR, level M", detail: "byte mode, versions 1–6" },
          { label: "Target", value: "Public booking page" },
        ]}
      />

      <div className="mb-4 rounded-xl border border-line bg-canvas px-5 py-3 print:hidden">
        <p className="text-[13px] text-ink-500">
          The encoder is written into the app rather than pulled from a package, the same way the world map ships as
          path data — the output is a few hundred rectangles of inline SVG, so nothing extra reaches the browser and
          the sheet prints at any size without going fuzzy.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {fleet.map((v) => {
          const url = `${SITE}/cars/${v.slug}`;
          return (
            <Card key={v.id} className="flex items-center gap-4 p-4">
              <QrCode value={url} />
              <div className="min-w-0">
                <p className="font-admin text-[14px] font-bold text-ink-900">{v.name}</p>
                <p className="text-[12px] text-ink-400">
                  {v.brand} · {v.bodyType}
                </p>
                <p className="mt-1 font-admin text-[13px] font-bold text-brand-500">
                  {formatCurrency(Number(v.pricePerDay))}
                  <span className="font-normal text-ink-400"> / day</span>
                </p>
                <p className="mt-1 truncate text-[11px] text-ink-400">/cars/{v.slug}</p>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
