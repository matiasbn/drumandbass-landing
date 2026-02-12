import Link from 'next/link';

export default function AuthCodeError() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#0a0a0a] border border-white/20 p-8 text-center">
        <h1 className="text-2xl font-mono text-[#ff0055] mb-4">
          ERROR DE AUTENTICACIÓN
        </h1>
        <p className="text-white/70 font-mono text-sm mb-6">
          Hubo un problema al verificar tu sesión. Por favor intenta iniciar sesión nuevamente.
        </p>
        <Link
          href="/club"
          className="inline-block px-6 py-3 bg-[#ff0055] text-white font-mono text-sm hover:bg-[#ff0055]/80 transition-colors"
        >
          VOLVER AL CLUB
        </Link>
      </div>
    </div>
  );
}
