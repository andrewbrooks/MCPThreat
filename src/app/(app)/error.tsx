"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 rounded-full bg-destructive/15 p-4">
        <AlertTriangle className="size-8 text-destructive" />
      </div>
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        An unexpected error occurred while loading this page.
      </p>
      <Button className="mt-4" variant="outline" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
