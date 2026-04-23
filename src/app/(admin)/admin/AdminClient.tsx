'use client';

import Link from 'next/link';
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

  const menuItems = [
    {
      title: 'Usuarios',
      description: 'Ver y gestionar usuarios registrados',
      href: '/admin/users',
    },
    {
      title: 'Newsletter',
      description: 'Importar y ver suscriptores de newsletter',
      href: '/admin/newsletter',
    },
  ];

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black uppercase">Admin Panel</h1>
          <p className="mono text-sm text-gray-600">
            Bienvenido, {profile?.name || user.email}
          </p>
        </div>
        <button
          onClick={() => signOut()}
          className="brutalist-border bg-black text-white px-4 py-2 font-bold uppercase text-sm hover:bg-gray-900 transition-colors cursor-pointer"
        >
          Cerrar sesion
        </button>
      </div>

      {/* Menu Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="brutalist-border bg-white p-6 brutalist-shadow hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
          >
            <h2 className="text-xl font-black uppercase mb-2">{item.title}</h2>
            <p className="mono text-sm text-gray-600">{item.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
