import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-2xl font-semibold">404 — Not found</h1>
      <p className="text-sm text-muted-foreground">This page could not be found.</p>
      <Link href="/" className="text-primary hover:underline">
        Go home
      </Link>
    </div>
  );
}
