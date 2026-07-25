'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

import { useAdminAuth } from '@/src/components/admin/AdminAuthContext';
import { Junglist } from '@/src/lib/supabase';
import dayjs from '@/src/lib/date';

type SortKey = 'created_at' | 'name';

// El instagram viene como @usuario (junglists) o como URL/handle (DJ, del presskit).
// Mostramos solo el @usuario, pero linkeamos a la URL real.
const igHandle = (v: string): string => {
  if (!v) return '';
  const t = v.trim().replace(/\/+$/, '');
  const m = t.match(/(?:instagram\.com|tiktok\.com|(?:x|twitter)\.com|facebook\.com)\/@?([^/?#]+)/i);
  return (m ? m[1] : t).replace(/^@/, '');
};
const igUrl = (v: string): string =>
  /^https?:\/\//.test(v.trim()) ? v.trim() : `https://instagram.com/${igHandle(v)}`;

// Un DJ es siempre junglist (DJ ⊃ junglist), pero vive en pk_profiles, no en la
// tabla junglists. Trae nombre artístico (name), nombre real (last_name) y slug.
// Se listan en una tabla aparte porque sus columnas difieren.
type JunglistRow = Junglist & { isDj?: boolean; slug?: string | null };

export default function JunglistsClient() {
  const { loading, isAdmin } = useAdminAuth();
  const [junglists, setJunglists] = useState<JunglistRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchJunglists = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch('/api/admin/junglists');
      const data = await res.json();
      if (data.junglists) setJunglists(data.junglists);
    } catch {
      // ignore
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchJunglists();
  }, [isAdmin, fetchJunglists]);

  const remove = async (j: JunglistRow) => {
    if (j.isDj) return; // los DJ no viven en la tabla junglists; no se borran acá
    if (!window.confirm(`¿Eliminar a ${j.name} ${j.last_name} (${j.email})?`)) return;
    setDeletingId(j.id);
    try {
      const res = await fetch(`/api/admin/junglists?id=${encodeURIComponent(j.id)}`, {
        method: 'DELETE',
      });
      if (res.ok) setJunglists((prev) => prev.filter((x) => x.id !== j.id));
    } finally {
      setDeletingId(null);
    }
  };

  const exportCsv = (rows: JunglistRow[], name: string) => {
    const header = ['tipo', 'nombre_dj', 'nombre_real', 'email', 'instagram', 'fecha_registro'];
    const escape = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
    const lines = rows.map((j) =>
      [j.isDj ? 'dj' : 'junglist', j.name, j.last_name, j.email, j.instagram, j.created_at]
        .map(escape)
        .join(',')
    );
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

  const q = query.trim().toLowerCase();
  const matches = (j: JunglistRow) =>
    !q || [j.name, j.last_name, j.email, j.instagram].some((v) => v?.toLowerCase().includes(q));
  const sortFn = (a: JunglistRow, b: JunglistRow) => {
    const cmp =
      sortKey === 'name'
        ? `${a.name} ${a.last_name}`.localeCompare(`${b.name} ${b.last_name}`)
        : dayjs(a.created_at).unix() - dayjs(b.created_at).unix();
    return sortAsc ? cmp : -cmp;
  };

  const junglistRows = junglists.filter((j) => !j.isDj).filter(matches).sort(sortFn);
  const djRows = junglists.filter((j) => j.isDj).filter(matches).sort(sortFn);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(key === 'name');
    }
  };
  const arrow = (key: SortKey) => (sortKey === key ? (sortAsc ? ' ▲' : ' ▼') : '');

  // Celda de instagram reutilizable.
  const insta = (j: JunglistRow) =>
    igHandle(j.instagram) ? (
      <a href={igUrl(j.instagram)} target="_blank" rel="noopener noreferrer" className="underline">
        @{igHandle(j.instagram)}
      </a>
    ) : (
      <span className="text-gray-300">—</span>
    );

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="mb-6">
        <Link href="/admin" className="mono text-xs uppercase underline text-gray-600 hover:text-black">
          ← Admin
        </Link>
        <h1 className="text-3xl font-black uppercase mt-1">Junglists</h1>
        <p className="mono text-sm text-gray-600">
          {junglistRows.length} junglists · {djRows.length} DJs
        </p>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por nombre, correo o instagram…"
        className="w-full border-4 border-black p-3 mono text-sm mb-6 focus:outline-none focus:bg-yellow-50"
      />

      {loadingList ? (
        <p className="mono text-sm uppercase text-gray-500">Cargando…</p>
      ) : (
        <>
          {/* JUNGLISTS (no DJs) */}
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-black uppercase">Junglists ({junglistRows.length})</h2>
            <button
              onClick={() => exportCsv(junglistRows, 'junglists')}
              disabled={junglistRows.length === 0}
              className="brutalist-border bg-black text-white px-3 py-1.5 mono text-[11px] font-bold uppercase hover:bg-gray-900 disabled:opacity-40"
            >
              CSV
            </button>
          </div>
          {junglistRows.length === 0 ? (
            <p className="mono text-sm uppercase text-gray-500 mb-8">Sin junglists.</p>
          ) : (
            <div className="overflow-x-auto brutalist-border bg-white mb-10">
              <table className="w-full text-left mono text-sm">
                <thead className="bg-black text-white uppercase text-xs">
                  <tr>
                    <th className="p-3 cursor-pointer whitespace-nowrap" onClick={() => toggleSort('name')}>
                      Nombre{arrow('name')}
                    </th>
                    <th className="p-3">Instagram</th>
                    <th className="p-3">Correo</th>
                    <th className="p-3 cursor-pointer whitespace-nowrap" onClick={() => toggleSort('created_at')}>
                      Registro{arrow('created_at')}
                    </th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {junglistRows.map((j) => (
                    <tr key={j.id} className="border-t-2 border-black align-top">
                      <td className="p-3 font-bold whitespace-nowrap">
                        {j.name} {j.last_name}
                      </td>
                      <td className="p-3 whitespace-nowrap">{insta(j)}</td>
                      <td className="p-3 whitespace-nowrap">{j.email}</td>
                      <td className="p-3 whitespace-nowrap">{dayjs(j.created_at).format('D MMM YYYY')}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => remove(j)}
                          disabled={deletingId === j.id}
                          className="mono text-xs uppercase underline text-gray-500 hover:text-red-600 disabled:opacity-40"
                        >
                          {deletingId === j.id ? '…' : 'Borrar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* DJs (nombre real + nombre de DJ + link al presskit) */}
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-black uppercase">DJs ({djRows.length})</h2>
            <button
              onClick={() => exportCsv(djRows, 'djs')}
              disabled={djRows.length === 0}
              className="brutalist-border bg-black text-white px-3 py-1.5 mono text-[11px] font-bold uppercase hover:bg-gray-900 disabled:opacity-40"
            >
              CSV
            </button>
          </div>
          {djRows.length === 0 ? (
            <p className="mono text-sm uppercase text-gray-500">Sin DJs.</p>
          ) : (
            <div className="overflow-x-auto brutalist-border bg-white">
              <table className="w-full text-left mono text-sm">
                <thead className="bg-[#7C3AED] text-white uppercase text-xs">
                  <tr>
                    <th className="p-3 whitespace-nowrap">Nombre</th>
                    <th className="p-3 cursor-pointer whitespace-nowrap" onClick={() => toggleSort('name')}>
                      Nombre de DJ{arrow('name')}
                    </th>
                    <th className="p-3">Instagram</th>
                    <th className="p-3 cursor-pointer whitespace-nowrap" onClick={() => toggleSort('created_at')}>
                      Registro{arrow('created_at')}
                    </th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {djRows.map((j) => (
                    <tr key={j.id} className="border-t-2 border-black align-top">
                      <td className="p-3 whitespace-nowrap">
                        {j.last_name || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="p-3 font-bold whitespace-nowrap">
                        {j.name || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="p-3 whitespace-nowrap">{insta(j)}</td>
                      <td className="p-3 whitespace-nowrap">{dayjs(j.created_at).format('D MMM YYYY')}</td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <Link
                          href={j.slug ? `/admin/presskits?slug=${j.slug}` : '/admin/presskits'}
                          className="mono text-xs uppercase underline text-gray-500 hover:text-black"
                        >
                          Editar presskit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
