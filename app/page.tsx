import Image from "next/image";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-12 md:p-24 font-[family-name:var(--font-geist-sans)]">
      <Image
        src="/logo.JPG"
        alt="Logo Drum & Bass Chile"
        width={256}
        height={256}
        className="rounded-full" // Esta clase de Tailwind hace la imagen redonda
        priority // Ayuda a que la imagen principal cargue más rápido
      />
      <h1 className="mt-4 mb-8 whitespace-nowrap text-center text-xl font-bold sm:text-2xl md:text-3xl">
        La comunidad oficial <br />
        del Drum and Bass en 🇨🇱
      </h1>
      <div className="flex w-full max-w-xs flex-col gap-4">
        <a
          href="/eventos"
          className="flex h-12 w-full items-center justify-center rounded-md border border-solid border-black/[.08] bg-white text-center text-base font-medium text-black transition-colors hover:bg-gray-100 dark:border-white/[.145] dark:bg-black dark:text-white dark:hover:bg-gray-900"
        >
          Eventos
        </a>
        <a
          href="/dj"
          className="flex h-12 w-full items-center justify-center rounded-md border border-solid border-black/[.08] bg-white text-center text-base font-medium text-black transition-colors hover:bg-gray-100 dark:border-white/[.145] dark:bg-black dark:text-white dark:hover:bg-gray-900"
        >
          DJs
        </a>
        <a
          href="#"
          className="flex h-12 w-full items-center justify-center rounded-md border border-solid border-black/[.08] bg-white text-center text-base font-medium text-black transition-colors hover:bg-gray-100 dark:border-white/[.145] dark:bg-black dark:text-white dark:hover:bg-gray-900"
        >
          Organizaciones
        </a>
      </div>
    </main>
  );
}
