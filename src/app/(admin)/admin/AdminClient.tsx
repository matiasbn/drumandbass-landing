'use client';

import { useAdminAuth } from '@/src/components/admin/AdminAuthContext';

export default function AdminClient() {
  const { user, profile, loading, isAdmin, signInWithGoogle, signOut } = useAdminAuth();

  if (loading) {
    return (
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-black border-r-transparent" />
        <p className="mt-4 mono text-sm uppercase">Cargando...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="brutalist-border bg-white p-8 brutalist-shadow text-center max-w-md">
        <h1 className="text-3xl font-black uppercase mb-6">Admin Panel</h1>
        <p className="mono text-sm mb-8 uppercase">Inicia sesion para continuar</p>
        <button
          onClick={() => signInWithGoogle()}
          className="brutalist-border bg-black text-white px-6 py-3 font-bold uppercase hover:bg-gray-900 transition-colors w-full cursor-pointer"
        >
          Iniciar sesion con Google
        </button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="brutalist-border bg-white p-8 brutalist-shadow text-center max-w-md">
        <h1 className="text-3xl font-black uppercase mb-4 text-red-600">Acceso Denegado</h1>
        <p className="mono text-sm mb-6 uppercase">
          No tienes permisos de administrador.
        </p>
        <button
          onClick={() => signOut()}
          className="brutalist-border bg-black text-white px-6 py-3 font-bold uppercase hover:bg-gray-900 transition-colors w-full cursor-pointer"
        >
          Cerrar sesion
        </button>
      </div>
    );
  }

  return (
    <div className="brutalist-border bg-white p-8 brutalist-shadow text-center max-w-md">
      <h1 className="text-3xl font-black uppercase mb-4">Admin Panel</h1>
      <p className="mono text-lg mb-6">
        Bienvenido, <span className="font-bold">{profile?.name || user.email}</span>
      </p>
      <button
        onClick={() => signOut()}
        className="brutalist-border bg-black text-white px-6 py-3 font-bold uppercase hover:bg-gray-900 transition-colors w-full cursor-pointer"
      >
        Cerrar sesion
      </button>
    </div>
  );
}
