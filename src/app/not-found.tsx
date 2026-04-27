import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center text-zinc-900 dark:text-zinc-100">
      <h1 className="text-lg font-semibold">Page not found</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">The page you requested does not exist.</p>
      <Link href="/" className="text-sm font-medium text-sky-600 underline dark:text-sky-400">
        Back to Command Center
      </Link>
    </div>
  );
}
