"use client";

function isChunkLoadError(error: Error): boolean {
  const name = error?.name ?? "";
  const msg = String(error?.message ?? "");
  return (
    name === "ChunkLoadError" ||
    /Loading chunk|chunk load|Failed to fetch dynamically imported module/i.test(msg)
  );
}

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunk = isChunkLoadError(error);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 p-6 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <h1 className="text-lg font-semibold">Admin could not load</h1>
      {chunk ? (
        <p className="max-w-md text-center text-sm text-zinc-600 dark:text-zinc-400">
          A JavaScript chunk failed to load. This often happens in development after a hot reload. Use{" "}
          <strong>Reload page</strong> or <strong>Try again</strong>, or run{" "}
          <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
            npm run dev:clean
          </code>{" "}
          from the <code className="rounded bg-zinc-200 px-1.5 dark:bg-zinc-800">web</code> folder, or hard
          refresh the browser (Ctrl+Shift+R).
        </p>
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{error.message || "Unknown error"}</p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
        >
          Reload page
        </button>
      </div>
    </div>
  );
}
