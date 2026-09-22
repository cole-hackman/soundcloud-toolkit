import { PageContainer, PageHeader, Skeleton, Card } from "@/components/ui";

/**
 * One `role="status"` around the skeleton, everything inside it `aria-hidden`.
 * See the note in `dashboard/loading.tsx`.
 *
 * The tab strip and the wide filler bars are sized in fractions rather than
 * fixed widths: `w-40 + w-40 + w-28` plus padding was 452px of tab strip and
 * `w-96` was a 384px bar, both wider than a 360px phone, so the skeleton
 * scrolled sideways before the page it stands in for had even loaded.
 */
export default function GrowthLoading() {
  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        title="Grow Your Network"
        description="Discover active SoundCloud users likely to follow you back, engage with their tracks, and reverse campaigns anytime."
      />

      <div role="status" aria-label="Loading">
        <span className="sr-only">Loading your growth tools…</span>

        <div aria-hidden="true">
          {/* Tabs Selector */}
          <div className="mb-6 grid w-full max-w-[320px] grid-cols-3 gap-1 rounded-lg border-2 border-border/50 bg-secondary/20 p-1">
            <Skeleton className="h-8 w-full rounded-md" />
            <Skeleton className="h-8 w-full rounded-md" />
            <Skeleton className="h-8 w-full rounded-md" />
          </div>

          <Card className="p-6">
            <Skeleton className="h-5 w-full max-w-64 mb-2" />
            <Skeleton className="h-4 w-full max-w-96 mb-4" />

            <div className="flex flex-wrap items-center gap-4 mb-4">
              <Skeleton className="h-10 w-full min-w-0 flex-1 sm:min-w-[240px] rounded-lg" />
              <Skeleton className="h-10 w-full max-w-52 rounded-lg" />
            </div>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
