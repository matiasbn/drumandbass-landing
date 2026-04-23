'use client';

import Link from 'next/link';
import { useAdminAuth } from '@/src/components/admin/AdminAuthContext';
import { useEffect, useState, useCallback } from 'react';
import { UserProfile } from '@/src/lib/supabase';

interface EditForm {
  name: string;
  username: string;
  email: string;
  score: number;
  high_score: number;
  is_admin: boolean;
}

export default function UsersClient() {
  const { user, loading, isAdmin, signInWithGoogle, signOut } = useAdminAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users);
      } else {
        setError(data.error);
      }
    } catch {
      setError('Error al cargar usuarios');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    fetchUsers();
  }, [isAdmin, fetchUsers]);

  const openEdit = (u: UserProfile) => {
    setEditingUser(u);
    setEditForm({
      name: u.name,
      username: u.username,
      email: u.email,
      score: u.score ?? 0,
      high_score: u.high_score ?? 0,
      is_admin: u.is_admin ?? false,
    });
    setSaveError(null);
  };

  const closeEdit = () => {
    setEditingUser(null);
    setEditForm(null);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!editingUser || !editForm) return;
    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingUser.id, ...editForm }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSaveError(data.error);
        return;
      }

      // Update local state
      setUsers((prev) =>
        prev.map((u) => (u.id === editingUser.id ? { ...u, ...data.user } : u))
      );
      closeEdit();
    } catch {
      setSaveError('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

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
        <p className="mono text-sm mb-6 uppercase">No tienes permisos de administrador.</p>
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
    <div className="w-full max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="brutalist-border bg-white px-3 py-1 font-bold text-sm uppercase hover:bg-gray-100 transition-colors"
          >
            &larr; Volver
          </Link>
          <h1 className="text-3xl font-black uppercase">Usuarios</h1>
        </div>
      </div>

      {/* Users Table */}
      <div className="brutalist-border bg-white brutalist-shadow">
        <div className="p-4 border-b-4 border-black">
          <h2 className="text-xl font-black uppercase">
            Usuarios Registrados
            {!loadingUsers && (
              <span className="ml-2 text-gray-500 text-base">({users.length})</span>
            )}
          </h2>
        </div>

        {loadingUsers ? (
          <div className="p-8 text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-black border-r-transparent" />
            <p className="mt-2 mono text-sm uppercase">Cargando usuarios...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 mono text-sm uppercase">{error}</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center mono text-sm uppercase text-gray-500">
            No hay usuarios registrados
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-black bg-gray-50">
                  <th className="text-left p-3 mono text-xs uppercase font-bold">Nombre</th>
                  <th className="text-left p-3 mono text-xs uppercase font-bold">Username</th>
                  <th className="text-left p-3 mono text-xs uppercase font-bold">Email</th>
                  <th className="text-left p-3 mono text-xs uppercase font-bold">Score</th>
                  <th className="text-left p-3 mono text-xs uppercase font-bold">Admin</th>
                  <th className="text-left p-3 mono text-xs uppercase font-bold">Registro</th>
                  <th className="text-left p-3 mono text-xs uppercase font-bold"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="p-3 text-sm font-medium">{u.name}</td>
                    <td className="p-3 mono text-sm">{u.username}</td>
                    <td className="p-3 mono text-sm text-gray-600">{u.email}</td>
                    <td className="p-3 mono text-sm">{u.score ?? 0}</td>
                    <td className="p-3">
                      {u.is_admin ? (
                        <span className="bg-black text-white px-2 py-0.5 text-xs font-bold uppercase">
                          Admin
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="p-3 mono text-xs text-gray-500">
                      {new Date(u.created_at).toLocaleDateString('es-CL')}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => openEdit(u)}
                        className="bg-black text-white px-3 py-1 text-xs font-bold uppercase hover:bg-gray-800 transition-colors cursor-pointer"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingUser && editForm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeEdit();
          }}
        >
          <div className="brutalist-border bg-white p-6 brutalist-shadow w-full max-w-md">
            <h2 className="text-xl font-black uppercase mb-6">Editar Usuario</h2>

            {saveError && (
              <div className="bg-red-100 text-red-700 p-3 mb-4 mono text-sm">{saveError}</div>
            )}

            <div className="space-y-4">
              <div>
                <label className="mono text-xs uppercase font-bold block mb-1">Nombre</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full brutalist-border p-2 text-sm"
                />
              </div>

              <div>
                <label className="mono text-xs uppercase font-bold block mb-1">Username</label>
                <input
                  type="text"
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                  className="w-full brutalist-border p-2 text-sm"
                />
              </div>

              <div>
                <label className="mono text-xs uppercase font-bold block mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full brutalist-border p-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mono text-xs uppercase font-bold block mb-1">Score</label>
                  <input
                    type="number"
                    value={editForm.score}
                    onChange={(e) => setEditForm({ ...editForm, score: parseInt(e.target.value) || 0 })}
                    className="w-full brutalist-border p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mono text-xs uppercase font-bold block mb-1">High Score</label>
                  <input
                    type="number"
                    value={editForm.high_score}
                    onChange={(e) => setEditForm({ ...editForm, high_score: parseInt(e.target.value) || 0 })}
                    className="w-full brutalist-border p-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_admin"
                  checked={editForm.is_admin}
                  onChange={(e) => setEditForm({ ...editForm, is_admin: e.target.checked })}
                  className="h-4 w-4"
                />
                <label htmlFor="is_admin" className="mono text-xs uppercase font-bold">
                  Administrador
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 brutalist-border bg-black text-white px-4 py-2 font-bold uppercase text-sm hover:bg-gray-900 transition-colors cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                onClick={closeEdit}
                disabled={saving}
                className="flex-1 brutalist-border bg-white px-4 py-2 font-bold uppercase text-sm hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
