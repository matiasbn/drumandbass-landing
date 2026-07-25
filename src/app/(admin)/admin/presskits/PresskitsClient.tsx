'use client';

import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '@/src/components/admin/AdminAuthContext';
import { PresskitMix, PresskitSocial, PresskitLink } from '@/src/types/presskit';
import { socialToHandle, socialToUrl } from '@/src/lib/socials';

// Handle de Instagram de un presskit (guardado en socials como usuario).
const igOf = (pk: { socials?: { platform?: string; url?: string }[] }): string => {
  const ig = (pk.socials || []).find((s) => /instagram/i.test(s.platform || ''));
  return ig ? socialToHandle('Instagram', ig.url || '') : '';
};

// Mismas opciones que el formulario del DJ (pk/edit): Instagram va aparte.
const SOCIAL_PLATFORM_OPTIONS = ['SoundCloud', 'Spotify', 'YouTube', 'TikTok', 'Facebook', 'Bandcamp', 'Mixcloud', 'Beatport', 'Web'];
const MIX_PLATFORM_OPTIONS = ['SoundCloud', 'YouTube', 'Spotify', 'Bandcamp', 'Mixcloud'];

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
  socials: PresskitSocial[];
  links: PresskitLink[];
  mixes: PresskitMix[];
}

interface EditForm {
  artist_name: string;
  real_name: string;
  city: string;
  country: string;
  bio: string;
  published: boolean;
  genres: string; // separado por comas
  instagram: string; // handle dedicado
  socials: PresskitSocial[]; // sin Instagram
  mixes: PresskitMix[];
  links: PresskitLink[];
}

type SortKey = 'artist_name' | 'real_name' | 'city' | 'published' | 'created_at';

export default function PresskitsClient() {
  const { loading, isAdmin } = useAdminAuth();
  const [presskits, setPresskits] = useState<PresskitItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    artist_name: '', real_name: '', city: '', country: '', bio: '', published: false,
    genres: '', instagram: '', socials: [], mixes: [], links: [],
  });
  const [saving, setSaving] = useState(false);
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

  // Al llegar desde "Editar presskit" (?slug=…), abre ese presskit y hace scroll.
  // Solo una vez, cuando ya cargaron los presskits. Debe ir ANTES de los return
  // tempranos para no romper el orden de hooks. startEdit se define más abajo,
  // así que lo alcanzamos vía ref.
  const startEditRef = useRef<((pk: PresskitItem) => void) | null>(null);
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (autoOpenedRef.current || presskits.length === 0) return;
    const slug = new URLSearchParams(window.location.search).get('slug');
    if (!slug) {
      autoOpenedRef.current = true;
      return;
    }
    const pk = presskits.find((p) => p.slug === slug);
    if (pk) {
      autoOpenedRef.current = true;
      startEditRef.current?.(pk);
      setTimeout(() => {
        document.getElementById(`pk-${pk.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    }
  }, [presskits]);

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
    const socials = pk.socials || [];
    const ig = socials.find((s) => /instagram/i.test(s.platform || ''));
    setEditForm({
      artist_name: pk.artist_name || '',
      real_name: pk.real_name || '',
      city: pk.city || '',
      country: pk.country || '',
      bio: pk.bio || '',
      published: pk.published,
      genres: (pk.genres || []).join(', '),
      instagram: ig ? socialToHandle('Instagram', ig.url) : '',
      socials: socials.filter((s) => !/instagram/i.test(s.platform || '')),
      mixes: (pk.mixes || []).map((m) => ({ ...m })),
      links: (pk.links || []).map((l) => ({ ...l })),
    });
  };
  startEditRef.current = startEdit;

  // Helpers de edición para las listas del formulario.
  const setField = <K extends keyof EditForm>(key: K, value: EditForm[K]) =>
    setEditForm((f) => ({ ...f, [key]: value }));
  const updateSocial = (i: number, patch: Partial<PresskitSocial>) =>
    setEditForm((f) => ({ ...f, socials: f.socials.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) }));
  const addSocial = () => setEditForm((f) => ({ ...f, socials: [...f.socials, { platform: 'SoundCloud', url: '' }] }));
  const removeSocial = (i: number) => setEditForm((f) => ({ ...f, socials: f.socials.filter((_, idx) => idx !== i) }));
  const updateMix = (i: number, patch: Partial<PresskitMix>) =>
    setEditForm((f) => ({ ...f, mixes: f.mixes.map((m, idx) => (idx === i ? { ...m, ...patch } : m)) }));
  const addMix = () => setEditForm((f) => ({ ...f, mixes: [...f.mixes, { title: '', platform: 'SoundCloud', url: '', type: 'set' }] }));
  const removeMix = (i: number) => setEditForm((f) => ({ ...f, mixes: f.mixes.filter((_, idx) => idx !== i) }));
  const updateLink = (i: number, patch: Partial<PresskitLink>) =>
    setEditForm((f) => ({ ...f, links: f.links.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) }));
  const addLink = () => setEditForm((f) => ({ ...f, links: [...f.links, { title: '', url: '' }] }));
  const removeLink = (i: number) => setEditForm((f) => ({ ...f, links: f.links.filter((_, idx) => idx !== i) }));

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    // Instagram (handle) va primero; el resto de redes detrás, guardadas como
    // handle/usuario (no URL), igual que el formulario del DJ.
    const igHandle = socialToHandle('Instagram', editForm.instagram);
    const socials = [
      ...(igHandle ? [{ platform: 'Instagram', url: igHandle }] : []),
      ...editForm.socials
        .filter((s) => s.url.trim())
        .map((s) => ({ platform: s.platform, url: socialToHandle(s.platform, s.url) })),
    ];
    const payload = {
      id: editingId,
      artist_name: editForm.artist_name,
      real_name: editForm.real_name,
      city: editForm.city,
      country: editForm.country,
      bio: editForm.bio,
      published: editForm.published,
      genres: editForm.genres.split(',').map((g) => g.trim()).filter(Boolean),
      socials,
      mixes: editForm.mixes.filter((m) => m.title.trim() && m.url.trim()),
      links: editForm.links.filter((l) => l.title.trim() && l.url.trim()),
    };
    setSaving(true);
    try {
      const res = await fetch('/api/admin/presskits', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
                  <th className="text-left py-2 pr-4">Instagram</th>
                  <th className="text-left py-2 pr-4">Slug</th>
                  <th className="text-left py-2 pr-4 cursor-pointer select-none hover:text-gray-600" onClick={() => toggleSort('published')}>Estado{sortArrow('published')}</th>
                  <th className="text-left py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sortedPresskits.map((pk) => {
                  return (
                  <Fragment key={pk.id}>
                  <tr id={`pk-${pk.id}`} className="border-b border-gray-300 scroll-mt-24">
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
                        {/* Instagram (el usuario se edita en el panel de abajo). */}
                        <td className="py-2 pr-4 text-gray-500">
                          {igOf(pk) ? `@${igOf(pk)}` : '-'}
                        </td>
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
                        <td className="py-2 pr-4">
                          {igOf(pk) ? (
                            <a
                              href={socialToUrl('Instagram', igOf(pk))}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline hover:text-gray-600"
                            >
                              @{igOf(pk)}
                            </a>
                          ) : '-'}
                        </td>
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
                      <td colSpan={6} className="py-4 px-3">
                        {/* Datos del formulario (todo salvo imágenes) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                          <label className="mono text-xs font-bold uppercase">
                            Ciudad
                            <input
                              value={editForm.city}
                              onChange={(e) => setField('city', e.target.value)}
                              className="block w-full mt-1 border-2 border-black px-2 py-1 text-sm normal-case"
                              placeholder="Ciudad"
                            />
                          </label>
                          <label className="mono text-xs font-bold uppercase">
                            País
                            <input
                              value={editForm.country}
                              onChange={(e) => setField('country', e.target.value)}
                              className="block w-full mt-1 border-2 border-black px-2 py-1 text-sm normal-case"
                              placeholder="País"
                            />
                          </label>
                          <label className="mono text-xs font-bold uppercase">
                            Instagram (usuario)
                            <input
                              value={editForm.instagram}
                              onChange={(e) => setField('instagram', e.target.value)}
                              className="block w-full mt-1 border-2 border-black px-2 py-1 text-sm normal-case"
                              placeholder="usuario"
                            />
                          </label>
                          <label className="mono text-xs font-bold uppercase">
                            Géneros (separados por coma)
                            <input
                              value={editForm.genres}
                              onChange={(e) => setField('genres', e.target.value)}
                              className="block w-full mt-1 border-2 border-black px-2 py-1 text-sm normal-case"
                              placeholder="Neurofunk, Jungle…"
                            />
                          </label>
                        </div>
                        <label className="block mono text-xs font-bold uppercase mb-4">
                          Bio
                          <textarea
                            value={editForm.bio}
                            onChange={(e) => setField('bio', e.target.value)}
                            rows={3}
                            className="block w-full mt-1 border-2 border-black px-2 py-1 text-sm normal-case"
                            placeholder="Bio del artista"
                          />
                        </label>

                        {/* Redes (sin Instagram, que va arriba) */}
                        <div className="flex items-center justify-between mb-2">
                          <p className="mono text-xs font-bold uppercase">Redes</p>
                          <button onClick={addSocial} className="border-2 border-black px-2 py-0.5 text-xs font-bold uppercase hover:bg-gray-100 cursor-pointer">+ Red</button>
                        </div>
                        <div className="space-y-2 mb-4">
                          {editForm.socials.length === 0 && <p className="mono text-xs text-gray-500">Sin otras redes.</p>}
                          {editForm.socials.map((s, i) => (
                            <div key={i} className="flex flex-wrap gap-2 items-center">
                              <select
                                value={s.platform}
                                onChange={(e) => updateSocial(i, { platform: e.target.value })}
                                className="border-2 border-black px-2 py-1 text-sm"
                              >
                                {SOCIAL_PLATFORM_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                              </select>
                              <input
                                value={s.url}
                                onChange={(e) => updateSocial(i, { url: e.target.value })}
                                className="flex-1 min-w-[160px] border-2 border-black px-2 py-1 text-sm"
                                placeholder="usuario o URL"
                              />
                              <button onClick={() => removeSocial(i)} className="border-2 border-red-600 text-red-600 px-2 py-1 text-xs font-bold uppercase hover:bg-red-50 cursor-pointer">×</button>
                            </div>
                          ))}
                        </div>

                        {/* Tracks / Sets & Releases (incluye los de SoundCloud) */}
                        <div className="flex items-center justify-between mb-2">
                          <p className="mono text-xs font-bold uppercase">Sets &amp; Releases</p>
                          <button onClick={addMix} className="border-2 border-black px-2 py-0.5 text-xs font-bold uppercase hover:bg-gray-100 cursor-pointer">+ Track</button>
                        </div>
                        <div className="space-y-2 mb-4">
                          {editForm.mixes.length === 0 && <p className="mono text-xs text-gray-500">Sin tracks.</p>}
                          {editForm.mixes.map((m, i) => (
                            <div key={i} className="border-2 border-black bg-white p-2 space-y-2">
                              <div className="flex flex-wrap gap-2 items-center">
                                <input
                                  value={m.title}
                                  onChange={(e) => updateMix(i, { title: e.target.value })}
                                  className="flex-1 min-w-[160px] border-2 border-black px-2 py-1 text-sm"
                                  placeholder="Título"
                                />
                                <select
                                  value={m.platform}
                                  onChange={(e) => updateMix(i, { platform: e.target.value })}
                                  className="border-2 border-black px-2 py-1 text-sm"
                                >
                                  {MIX_PLATFORM_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                                </select>
                                <select
                                  value={m.type || 'set'}
                                  onChange={(e) => updateMix(i, { type: e.target.value as 'set' | 'release' })}
                                  className="border-2 border-black px-2 py-1 text-sm"
                                >
                                  <option value="set">Set</option>
                                  <option value="release">Release</option>
                                </select>
                                <button onClick={() => removeMix(i)} className="border-2 border-red-600 text-red-600 px-2 py-1 text-xs font-bold uppercase hover:bg-red-50 cursor-pointer">×</button>
                              </div>
                              <div className="flex flex-wrap gap-3 items-center">
                                <input
                                  value={m.url}
                                  onChange={(e) => updateMix(i, { url: e.target.value })}
                                  className="flex-1 min-w-[220px] border-2 border-black px-2 py-1 text-sm"
                                  placeholder="URL"
                                />
                                {/* Featured solo aplica a releases de SoundCloud (Releases Nacionales) */}
                                {m.type === 'release' && m.platform === 'SoundCloud' && (
                                  <label className="mono text-xs font-bold uppercase flex items-center gap-1 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={!!m.featured}
                                      onChange={(e) => updateMix(i, { featured: e.target.checked })}
                                    />
                                    Releases Nacionales
                                  </label>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Links */}
                        <div className="flex items-center justify-between mb-2">
                          <p className="mono text-xs font-bold uppercase">Links</p>
                          <button onClick={addLink} className="border-2 border-black px-2 py-0.5 text-xs font-bold uppercase hover:bg-gray-100 cursor-pointer">+ Link</button>
                        </div>
                        <div className="space-y-2 mb-2">
                          {editForm.links.length === 0 && <p className="mono text-xs text-gray-500">Sin links.</p>}
                          {editForm.links.map((l, i) => (
                            <div key={i} className="flex flex-wrap gap-2 items-center">
                              <input
                                value={l.title}
                                onChange={(e) => updateLink(i, { title: e.target.value })}
                                className="min-w-[140px] border-2 border-black px-2 py-1 text-sm"
                                placeholder="Título"
                              />
                              <input
                                value={l.url}
                                onChange={(e) => updateLink(i, { url: e.target.value })}
                                className="flex-1 min-w-[200px] border-2 border-black px-2 py-1 text-sm"
                                placeholder="URL"
                              />
                              <button onClick={() => removeLink(i)} className="border-2 border-red-600 text-red-600 px-2 py-1 text-xs font-bold uppercase hover:bg-red-50 cursor-pointer">×</button>
                            </div>
                          ))}
                        </div>

                        <p className="mono text-[11px] text-gray-500 mt-3">
                          Registrado: <strong>{new Date(pk.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
                          {' · '}Las imágenes las edita el DJ desde su presskit.
                        </p>
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
