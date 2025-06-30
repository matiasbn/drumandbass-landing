export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 font-[family-name:var(--font-geist-sans)]">
      <div className="flex w-full max-w-xs flex-col gap-4">
        <a
          href="#"
          className="flex h-12 w-full items-center justify-center rounded-md border border-solid border-black/[.08] bg-white text-center text-base font-medium text-black transition-colors hover:bg-gray-100 dark:border-white/[.145] dark:bg-black dark:text-white dark:hover:bg-gray-900"
        >
          Link 1
        </a>
        <a
          href="#"
          className="flex h-12 w-full items-center justify-center rounded-md border border-solid border-black/[.08] bg-white text-center text-base font-medium text-black transition-colors hover:bg-gray-100 dark:border-white/[.145] dark:bg-black dark:text-white dark:hover:bg-gray-900"
        >
          Link 2
        </a>
      </div>
    </main>
  );
}
