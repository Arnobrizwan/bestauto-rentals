import { Skeleton } from "@/components/ui";

/** Streamed placeholder for the customer site while a page's data resolves. */
export default function SiteLoading() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-52 rounded-lg" />
      <Skeleton className="mt-4 h-14 w-full max-w-2xl rounded-xl" />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-64 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
