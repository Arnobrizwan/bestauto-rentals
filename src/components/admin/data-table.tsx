import type { ReactNode } from "react";

import { Card, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";

export type Column = {
  label: string;
  /** Right-align numeric columns, as the design does. */
  align?: "left" | "right";
  className?: string;
};

/**
 * The table shell shared by every operations page.
 *
 * Callers supply the header labels and their own rows, so cell rendering stays
 * local to each page while the frame — card, header band, horizontal scroll,
 * empty state — is defined once. The minimum width is what forces the table to
 * scroll inside its own container rather than pushing the page sideways on a
 * phone.
 */
export function DataTable({
  columns,
  minWidth = 900,
  empty,
  toolbar,
  children,
  rowCount,
}: {
  columns: Column[];
  minWidth?: number;
  empty: { title: string; detail: string };
  toolbar?: ReactNode;
  children: ReactNode;
  rowCount: number;
}) {
  return (
    <Card className="overflow-hidden">
      {toolbar && (
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">{toolbar}</div>
      )}
      {rowCount === 0 ? (
        <EmptyState title={empty.title} detail={empty.detail} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth }}>
            <thead>
              <tr className="bg-canvas text-left">
                {columns.map((c) => (
                  <th
                    key={c.label}
                    className={cn(
                      "px-5 py-3 font-admin text-[13px] font-bold text-ink-900",
                      c.align === "right" && "text-right",
                      c.className,
                    )}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">{children}</tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/** A standard body cell. */
export function Td({
  children,
  align,
  strong,
  muted,
  className,
}: {
  children: ReactNode;
  align?: "right";
  strong?: boolean;
  muted?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "px-5 py-3.5 text-[13px]",
        align === "right" && "text-right",
        strong && "font-admin text-[14px] font-bold text-ink-900",
        muted && "text-ink-400",
        !strong && !muted && "text-ink-500",
        className,
      )}
    >
      {children}
    </td>
  );
}

/** The zebra-free hover row the design uses. */
export function Tr({ children }: { children: ReactNode }) {
  return <tr className="transition-colors hover:bg-canvas">{children}</tr>;
}
