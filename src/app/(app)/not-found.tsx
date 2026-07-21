import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 rounded-full bg-muted p-4">
        <FileQuestion className="size-8 text-muted-foreground" />
      </div>
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        This resource does not exist, or you do not have access to it.
      </p>
      <Link href="/" className={`mt-4 ${buttonVariants({ variant: "outline" })}`}>
        Back to dashboard
      </Link>
    </div>
  );
}
