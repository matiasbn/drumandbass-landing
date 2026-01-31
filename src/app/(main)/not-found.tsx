import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex-1 flex items-center justify-center p-6 lg:p-12">
      <div className="text-center brutalist-border p-12 brutalist-shadow max-w-lg w-full">
        <h1 className="text-9xl font-black italic text-[#ff0000]">404</h1>
        <p className="mono font-bold text-xl uppercase mt-4 mb-8">
          Página no encontrada
        </p>
        <Link
          href="/"
          className="inline-block px-8 py-4 bg-black text-white font-black uppercase mono text-lg border-4 border-black brutalist-shadow-red hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
