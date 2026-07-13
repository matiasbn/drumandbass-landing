'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

import { useAdminAuth } from '@/src/components/admin/AdminAuthContext';
import { Junglist } from '@/src/lib/supabase';
import dayjs from '@/src/lib/date';

type SortKey = 'created_at' | 'name';

export default function JunglistsClient() {
  const { loading, isAdmin } = useAdminAuth();
  const [junglists, setJunglists] = useState<Junglist[]>([]);
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

  const remove = async (j: Junglist) => {
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

  const exportCsv = () => {
    const header = ['nombre', 'apellido', 'email', 'instagram', 'fecha_registro'];
    const escape = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
    const lines = filtered.map((j) =>
      [j.name, j.last_name, j.email, j.instagram, j.created_at].map(escape).join(',')
    );
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'junglists.csv';
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
  const filtered = junglists
    .filter((j) =>
      !q
        ? true
        : [j.name, j.last_name, j.email, j.instagram].some((v) => v?.toLowerCase().includes(q))
    )
    .sort((a, b) => {
      let cmp: number;
      if (sortKey === 'name') cmp = `${a.name} ${a.last_name}`.localeCompare(`${b.name} ${b.last_name}`);
      else cmp = dayjs(a.created_at).unix() - dayjs(b.created_at).unix();
      return sortAsc ? cmp : -cmp;
    });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(key === 'name');
    }
  };

  const arrow = (key: SortKey) => (sortKey === key ? (sortAsc ? ' ▲' : ' ▼') : '');

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/admin" className="mono text-xs uppercase underline text-gray-600 hover:text-black">
            ← Admin
          </Link>
          <h1 className="text-3xl font-black uppercase mt-1">Junglists</h1>
          <p className="mono text-sm text-gray-600">
            {junglists.length} registrados{q ? ` · ${filtered.length} en el filtro` : ''}
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="brutalist-border bg-black text-white px-4 py-2 mono text-xs font-bold uppercase hover:bg-gray-900 disabled:opacity-40"
        >
          Exportar CSV
        </button>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por nombre, correo o instagram…"
        className="w-full border-4 border-black p-3 mono text-sm mb-4 focus:outline-none focus:bg-yellow-50"
      />

      {loadingList ? (
        <p className="mono text-sm uppercase text-gray-500">Cargando junglists…</p>
      ) : filtered.length === 0 ? (
        <p className="mono text-sm uppercase text-gray-500">Sin junglists.</p>
      ) : (
        <div className="overflow-x-auto brutalist-border bg-white">
          <table className="w-full text-left mono text-sm">
            <thead className="bg-black text-white uppercase text-xs">
              <tr>
                <th className="p-3 cursor-pointer" onClick={() => toggleSort('name')}>
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
              {filtered.map((j) => (
                <tr key={j.id} className="border-t-2 border-black align-top">
                  <td className="p-3 font-bold">
                    {j.name} {j.last_name}
                  </td>
                  <td className="p-3">
                    <a
                      href={`https://instagram.com/${j.instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      @{j.instagram}
                    </a>
                  </td>
                  <td className="p-3">{j.email}</td>
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
    </div>
  );
}
