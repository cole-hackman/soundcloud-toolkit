import { PageContainer, PageHeader, Skeleton, Card } from "@/components/ui";

export default function CombineLoading() {
  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        title="Combine Playlists"
        description="Select playlists to merge. Duplicates will be automatically removed."
      />

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4 text-foreground">
              Your Playlists
            </h2>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="p-6 sticky top-24 space-y-5">
            <h2 className="text-xl font-bold text-foreground">
              Merge Settings
            </h2>
            
            <div>
              <label className="block text-sm font-medium mb-2 text-muted-foreground">
                Selected
              </label>
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>

            <div className="p-4 bg-secondary/20 rounded-lg">
              <div className="text-sm text-muted-foreground">Total Tracks</div>
              <Skeleton className="h-8 w-16 mt-1" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-muted-foreground">
                Merge into
              </label>
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-muted-foreground">
                New Playlist Name
              </label>
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>

            <Skeleton className="h-14 w-full rounded-lg mt-4" />
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
