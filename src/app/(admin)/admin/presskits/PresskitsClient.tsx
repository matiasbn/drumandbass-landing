'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '@/src/components/admin/AdminAuthContext';
import { PresskitMix } from '@/src/types/presskit';

interface PresskitItem {
  id: string;
  user_id: string;
  artist_name: string;
  real_name: string | null;
  city: string | null;
  country: string | null;
  genres: string[];
  bio: string | null;
  photo_url: string | null;
  published: boolean;
  slug: string | null;
  email: string | null;
  created_at: string;
  mixes: PresskitMix[];
}

// Un release cuenta como "publicado en Releases Nacionales" si está marcado como
// featured, es tipo release y de SoundCloud (misma regla que el home).
function isFeaturedRelease(m: PresskitMix): boolean {
  return !!m.featured && m.type === 'release' && m.platform === 'SoundCloud';
}

type SortKey = 'artist_name' | 'real_name' | 'city' | 'published' | 'created_at';

export default function PresskitsClient() {
  const { loading, isAdmin } = useAdminAuth();
  const [presskits, setPresskits] = useState<PresskitItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ artist_name: '', real_name: '', city: '', country: '', bio: '', published: false });
  const [saving, setSaving] = useState(false);
  const [unfeaturingKey, setUnfeaturingKey] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortAsc, setSortAsc] = useState(false);

  const fetchPresskits = useCallback(async () => {
    setLoadingData(true);
    try {
      const res = await fetch('/api/admin/presskits');
      const data = await res.json();
      if (data.presskits) setPresskits(data.presskits);
    } catch {
      // ignore
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchPresskits();
  }, [isAdmin, fetchPresskits]);

  if (loading) {
    return (
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-black border-r-transparent" />
        <p className="mt-4 mono text-sm uppercase">Cargando...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="brutalist-border bg-white p-8 brutalist-shadow text-center max-w-md">
        <p className="mono text-sm uppercase">No autorizado</p>
      </div>
    );
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const sortedPresskits = [...presskits].sort((a, b) => {
    let valA: string, valB: string;
    if (sortKey === 'published') {
      valA = a.published ? '1' : '0';
      valB = b.published ? '1' : '0';
    } else {
      valA = (a[sortKey] ?? '') as string;
      valB = (b[sortKey] ?? '') as string;
    }
    const cmp = valA.localeCompare(valB, 'es', { sensitivity: 'base' });
    return sortAsc ? cmp : -cmp;
  });

  const sortArrow = (key: SortKey) =>
    sortKey === key ? (sortAsc ? ' ↑' : ' ↓') : '';

  const startEdit = (pk: PresskitItem) => {
    setEditingId(pk.id);
    setEditForm({
      artist_name: pk.artist_name || '',
      real_name: pk.real_name || '',
      city: pk.city || '',
      country: pk.country || '',
      bio: pk.bio || '',
      published: pk.published,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/presskits', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, ...editForm }),
      });
      const data = await res.json();
      if (data.presskit) {
        setPresskits((prev) =>
          prev.map((pk) => pk.id === editingId ? { ...pk, ...data.presskit } : pk)
        );
        setEditingId(null);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async (pk: PresskitItem) => {
    try {
      const res = await fetch('/api/admin/presskits', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pk.id, published: !pk.published }),
      });
      const data = await res.json();
      if (data.presskit) {
        setPresskits((prev) =>
          prev.map((p) => p.id === pk.id ? { ...p, published: data.presskit.published } : p)
        );
      }
    } catch {
      // ignore
    }
  };

  // Desmarca un release publicado (featured=false) y persiste el array completo.
  const unfeatureTrack = async (pk: PresskitItem, mixIndex: number) => {
    const newMixes = pk.mixes.map((m, i) =>
      i === mixIndex ? { ...m, featured: false } : m
    );
    setUnfeaturingKey(`${pk.id}:${mixIndex}`);
    try {
      const res = await fetch('/api/admin/presskits', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pk.id, mixes: newMixes }),
      });
      const data = await res.json();
      if (data.presskit) {
        setPresskits((prev) =>
          prev.map((p) => (p.id === pk.id ? { ...p, mixes: data.presskit.mixes } : p))
        );
      }
    } catch {
      // ignore
    } finally {
      setUnfeaturingKey(null);
    }
  };

  const handleDelete = async (pk: PresskitItem) => {
    if (!confirm(`Eliminar press kit de ${pk.artist_name}?`)) return;
    try {
      const res = await fetch(`/api/admin/presskits?id=${pk.id}&user_id=${pk.user_id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setPresskits((prev) => prev.filter((p) => p.id !== pk.id));
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/admin" className="mono text-sm text-gray-600 hover:text-black uppercase">
            &larr; Volver al Admin
          </Link>
          <h1 className="text-3xl font-black uppercase mt-2">
            Press Kits {!loadingData && <span className="text-gray-400">({presskits.length})</span>}
          </h1>
        </div>
      </div>

      {/* Table */}
      <div className="brutalist-border bg-white p-6 brutalist-shadow">
        {loadingData ? (
          <div className="text-center py-8">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-black border-r-transparent" />
          </div>
        ) : presskits.length === 0 ? (
          <p className="mono text-sm text-gray-600">No hay press kits aun.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full mono text-sm">
              <thead>
                <tr className="border-b-4 border-black">
                  <th className="text-left py-2 pr-4 cursor-pointer select-none hover:text-gray-600" onClick={() => toggleSort('artist_name')}>Artista{sortArrow('artist_name')}</th>
                  <th className="text-left py-2 pr-4 cursor-pointer select-none hover:text-gray-600" onClick={() => toggleSort('real_name')}>Nombre Real{sortArrow('real_name')}</th>
                  <th className="text-left py-2 pr-4">Email</th>
                  <th className="text-left py-2 pr-4">Slug</th>
                  <th className="text-left py-2 pr-4 cursor-pointer select-none hover:text-gray-600" onClick={() => toggleSort('published')}>Estado{sortArrow('published')}</th>
                  <th className="text-left py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sortedPresskits.map((pk) => {
                  const featured = (pk.mixes || [])
                    .map((m, idx) => ({ m, idx }))
                    .filter(({ m }) => isFeaturedRelease(m));
                  return (
                  <Fragment key={pk.id}>
                  <tr className="border-b border-gray-300">
                    {editingId === pk.id ? (
                      <>
                        <td className="py-2 pr-2">
                          <input
                            value={editForm.artist_name}
                            onChange={(e) => setEditForm({ ...editForm, artist_name: e.target.value })}
                            className="w-full border-2 border-black px-2 py-1 text-sm"
                            placeholder="Artista"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            value={editForm.real_name}
                            onChange={(e) => setEditForm({ ...editForm, real_name: e.target.value })}
                            className="w-full border-2 border-black px-2 py-1 text-sm"
                            placeholder="Nombre real"
                          />
                        </td>
                        {/* Email es de solo lectura (viene de pk_profiles). */}
                        <td className="py-2 pr-4 text-gray-500">{pk.email || '-'}</td>
                        <td className="py-2 pr-4 text-gray-500">{pk.slug || '-'}</td>
                        <td className="py-2 pr-4">
                          <button
                            onClick={() => setEditForm({ ...editForm, published: !editForm.published })}
                            className={`px-2 py-0.5 text-xs font-bold uppercase cursor-pointer ${editForm.published ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'}`}
                          >
                            {editForm.published ? 'Publicado' : 'Borrador'}
                          </button>
                        </td>
                        <td className="py-2">
                          <div className="flex gap-2">
                            <button
                              onClick={saveEdit}
                              disabled={saving}
                              className="bg-black text-white px-3 py-1 text-xs font-bold uppercase hover:bg-gray-900 cursor-pointer disabled:opacity-50"
                            >
                              {saving ? '...' : 'Guardar'}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="border-2 border-black px-3 py-1 text-xs font-bold uppercase hover:bg-gray-100 cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2 pr-4 font-bold">{pk.artist_name}</td>
                        <td className="py-2 pr-4">{pk.real_name || '-'}</td>
                        <td className="py-2 pr-4">{pk.email || '-'}</td>
                        <td className="py-2 pr-4">
                          {pk.slug ? (
                            <a href={`/pk/${pk.slug}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">
                              {pk.slug}
                            </a>
                          ) : '-'}
                        </td>
                        <td className="py-2 pr-4">
                          <button
                            onClick={() => togglePublished(pk)}
                            className={`px-2 py-0.5 text-xs font-bold uppercase cursor-pointer ${pk.published ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'}`}
                          >
                            {pk.published ? 'Publicado' : 'Borrador'}
                          </button>
                        </td>
                        <td className="py-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEdit(pk)}
                              className="border-2 border-black px-3 py-1 text-xs font-bold uppercase hover:bg-gray-100 cursor-pointer"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDelete(pk)}
                              className="border-2 border-red-600 text-red-600 px-3 py-1 text-xs font-bold uppercase hover:bg-red-50 cursor-pointer"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                  {editingId === pk.id && (
                    <tr className="border-b border-gray-300 bg-gray-50">
                      <td colSpan={6} className="py-3 px-2">
                        <div className="flex flex-wrap gap-6 mb-4 items-end">
                          <label className="mono text-xs font-bold uppercase">
                            Ciudad
                            <input
                              value={editForm.city}
                              onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                              className="block mt-1 border-2 border-black px-2 py-1 text-sm normal-case"
                              placeholder="Ciudad"
                            />
                          </label>
                          <span className="mono text-xs text-gray-600 uppercase">
                            Registrado:{' '}
                            <strong>{new Date(pk.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
                          </span>
                        </div>
                        <p className="mono text-xs font-bold uppercase mb-2">
                          Releases publicados en Releases Nacionales
                        </p>
                        {featured.length === 0 ? (
                          <p className="mono text-xs text-gray-500">
                            Este DJ no tiene releases publicados.
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {featured.map(({ m, idx }) => {
                              const key = `${pk.id}:${idx}`;
                              return (
                                <li
                                  key={idx}
                                  className="flex items-center justify-between gap-3 border-2 border-black bg-white px-3 py-2"
                                >
                                  <div className="min-w-0">
                                    <a
                                      href={m.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="mono text-xs font-bold underline hover:text-gray-600 truncate block"
                                    >
                                      {m.title}
                                    </a>
                                    {m.released_at && (
                                      <span className="mono text-[10px] text-gray-500">
                                        {new Date(m.released_at).toLocaleDateString('es-CL', {
                                          day: '2-digit',
                                          month: 'short',
                                          year: 'numeric',
                                        })}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => unfeatureTrack(pk, idx)}
                                    disabled={unfeaturingKey === key}
                                    className="border-2 border-red-600 text-red-600 px-3 py-1 text-xs font-bold uppercase hover:bg-red-50 cursor-pointer disabled:opacity-50 shrink-0"
                                  >
                                    {unfeaturingKey === key ? '...' : 'Desmarcar'}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
