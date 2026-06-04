import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F7F7F5] px-4">
      <div className="animate-fade-in-up text-center">
        <p className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-7xl font-bold text-transparent">
          404
        </p>
        <h1 className="mt-4 text-2xl font-semibold text-gray-900">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="btn-press rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-gray-800 hover:shadow-md"
          >
            Go home
          </Link>
          <Link
            href="/dashboard"
            className="btn-press rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm"
          >
            Open dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
