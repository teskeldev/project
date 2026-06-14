import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="animate-fade-in-up text-center">
        <p className="bg-gradient-to-r from-accent to-accent-hover bg-clip-text text-7xl font-bold text-transparent">
          404
        </p>
        <h1 className="mt-4 text-2xl font-semibold text-foreground">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="btn-press rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-background shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md"
          >
            Go home
          </Link>
          <Link
            href="/dashboard"
            className="btn-press rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-all duration-200 hover:bg-surface-soft hover:shadow-sm"
          >
            Open dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
