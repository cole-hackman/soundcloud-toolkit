import { PageContainer, PageHeader, Skeleton, Card } from "@/components/ui";

export default function GrowthLoading() {
  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        title="Grow Your Network"
        description="Discover active SoundCloud users likely to follow you back, engage with their tracks, and reverse campaigns anytime."
      />

      {/* Tabs Selector */}
      <div className="flex bg-secondary/20 p-1 rounded-lg border-2 border-border/50 self-start mb-6 w-fit gap-1">
        <Skeleton className="h-8 w-40 rounded-md" />
        <Skeleton className="h-8 w-40 rounded-md" />
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>

      <Card className="p-6">
        <Skeleton className="h-5 w-64 mb-2" />
        <Skeleton className="h-4 w-96 mb-4" />

        <div className="flex flex-wrap items-center gap-4 mb-4">
          <Skeleton className="h-10 flex-1 min-w-[240px] rounded-lg" />
          <Skeleton className="h-10 w-52 rounded-lg" />
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </Card>
    </PageContainer>
  );
}
