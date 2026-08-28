import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";

export type Stat = {
  label: string;
  value: string;
  /** Optional supporting line under the figure. */
  detail?: string;
  tone?: "default" | "warning" | "danger" | "success";
};

const TONES = {
  default: "text-ink-900",
  warning: "text-brand-500",
  danger: "text-danger",
  success: "text-success",
} as const;

/**
 * The stat strip every operations page opens with. One component so the four
 * figures at the top of a page cannot drift in size or spacing between routes.
 */
export function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <div
      className={cn(
        "mb-5 grid gap-4",
        stats.length >= 4 ? "sm:grid-cols-2 xl:grid-cols-4" : stats.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
      )}
    >
      {stats.map((stat) => (
        <Card key={stat.label} className="px-5 py-4">
          <p className="text-[13px] text-ink-400">{stat.label}</p>
          <p className={cn("mt-1 font-admin text-xl font-bold", TONES[stat.tone ?? "default"])}>{stat.value}</p>
          {stat.detail && <p className="mt-0.5 text-[12px] text-ink-400">{stat.detail}</p>}
        </Card>
      ))}
    </div>
  );
}
