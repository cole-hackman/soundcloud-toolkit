import { PageContainer, PageHeader, Skeleton, Card } from "@/components/ui";

/**
 * One `role="status"` around the skeleton, everything inside it `aria-hidden`.
 * See the note in `dashboard/loading.tsx`.
 */
export default function CombineLoading() {
  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        title="Combine Playlists"
        description="Select playlists to merge. Duplicates will be automatically removed."
      />

      <div role="status" aria-label="Loading">
        <span className="sr-only">Loading your playlists…</span>

        <div aria-hidden="true" className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="p-6">
              <p className="text-xl font-bold mb-4 text-foreground">Your Playlists</p>
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="p-6 lg:sticky lg:top-24 space-y-5">
              <p className="text-xl font-bold text-foreground">Merge Settings</p>

              <div>
                <p className="block text-sm font-medium mb-2 text-muted-foreground">Selected</p>
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>

              <div className="p-4 bg-secondary/20 rounded-lg">
                <div className="text-sm text-muted-foreground">Total Tracks</div>
                <Skeleton className="h-8 w-16 mt-1" />
              </div>

              <div>
                <p className="block text-sm font-medium mb-2 text-muted-foreground">Merge into</p>
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>

              <div>
                <p className="block text-sm font-medium mb-2 text-muted-foreground">
                  New Playlist Name
                </p>
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>

              <Skeleton className="h-14 w-full rounded-lg mt-4" />
            </Card>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
