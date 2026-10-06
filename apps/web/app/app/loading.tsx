// Shown instantly (via React Suspense) while any page under /app is loading its
// data. A skeleton that roughly matches the real layout feels far faster than a
// spinner, because the shape of the page appears immediately.
import { Skeleton } from "~/components/ui/skeleton";

export default function AppLoading() {
  return (
    <div className="container mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-border/60 p-4">
            <Skeleton className="aspect-square w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
