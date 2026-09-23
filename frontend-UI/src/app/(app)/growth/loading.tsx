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
          {/* Tabs Selector — mirrors the real strip: equal-width tabs on a phone,
              intrinsic width from `sm` up, so the skeleton never overflows a
              360px viewport the page itself fits in. */}
          <div className="mb-6 overflow-x-auto">
            <div className="flex w-full gap-1 rounded-lg border-2 border-border/50 bg-secondary/20 p-1 sm:w-fit">
              <Skeleton className="h-11 flex-1 rounded-md sm:w-40 sm:flex-none" />
              <Skeleton className="h-11 flex-1 rounded-md sm:w-40 sm:flex-none" />
              <Skeleton className="h-11 flex-1 rounded-md sm:w-28 sm:flex-none" />
            </div>
          </div>

          <Card className="p-6">
            <Skeleton className="h-5 w-full max-w-xs mb-2" />
            {/* `w-96` (384px) is wider than a 360px viewport: the skeleton, not
                the page, was what made /growth/ scroll sideways at load. */}
            <Skeleton className="h-4 w-full max-w-sm mb-4" />

            <div className="grid grid-cols-1 gap-3 mb-4 sm:grid-cols-2">
              <Skeleton className="h-11 w-full rounded-lg" />
              <Skeleton className="h-11 w-full rounded-lg" />
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
