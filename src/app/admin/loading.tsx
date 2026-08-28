import { Skeleton } from "@/components/ui";

/** Streamed placeholder for an admin page while its aggregates run. */
export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-56 rounded-lg" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full rounded" />
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="mt-5 h-96 rounded-2xl" />
    </div>
  );
}
