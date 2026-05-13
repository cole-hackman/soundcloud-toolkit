'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

export default function ExtensionConnectedPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <h1 className="text-lg font-semibold tracking-tight">Chrome extension connected</h1>
          <p className="text-sm text-muted-foreground">
            You are signed in to SoundCloud Toolkit. You can close this tab and return to the browser side panel to use
            likes → playlist and other tools.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            If the side panel still shows “Sign in,” click refresh session or open the panel again after a moment.
          </p>
          <Link
            href="/dashboard"
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-150',
              'bg-primary text-primary-foreground shadow-elevation-1',
              'hover:shadow-glow-sm hover:-translate-y-0.5',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            )}
          >
            Go to dashboard
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
