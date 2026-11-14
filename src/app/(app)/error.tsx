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
    <div role="alert" className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 rounded-full bg-destructive/15 p-4">
        <AlertTriangle className="size-8 text-destructive" />
      </div>
      <h1 className="text-xl font-semibold">This page could not be loaded</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        This page could not be loaded. Your data has not been changed. Try again, and if the
        problem continues, check the server log.
      </p>
      {error.digest ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Reference: <code className="font-mono">{error.digest}</code>
        </p>
      ) : null}
      <Button className="mt-4" variant="outline" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
