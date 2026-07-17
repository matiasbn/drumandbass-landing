'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

import { useAdminAuth } from '@/src/components/admin/AdminAuthContext';
import type { CmsStreamingRow } from '@/src/lib/cms';
import dayjs from '@/src/lib/date';

// CMS de streamings (reemplazo de Contentful): tabla cms_streamings.
// /api/live revisa esta tabla para decidir el banner EN VIVO; el CRUD pasa por
// /api/admin/streamings, que revalida ese endpoint.

const EMPTY_FORM = {
  name: '',
  youtube_url: '',
  date: '',
  end_date: '',
};

type FormFields = typeof EMPTY_FORM;

export default function StreamingsClient() {
  const { loading, isAdmin } = useAdminAuth();
  const [streamings, setStreamings] = useState<CmsStreamingRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  // null = solo lista · 'new' = creando · CmsStreamingRow = editando
  const [editing, setEditing] = useState<CmsStreamingRow | 'new' | null>(null);
  const [form, setForm] = useState<FormFields>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const fetchStreamings = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch('/api/admin/streamings');
      const data = await res.json();
      if (data.streamings) setStreamings(data.streamings);
    } catch {
      // ignore
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchStreamings();
  }, [isAdmin, fetchStreamings]);

  const openForm = (s: CmsStreamingRow | 'new') => {
    setMessage('');
    setEditing(s);
    setForm(
      s === 'new'
        ? EMPTY_FORM
        : { name: s.name, youtube_url: s.youtube_url, date: s.date, end_date: s.end_date ?? '' }
    );
  };

  const closeForm = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setMessage('');
  };

  const set = (key: keyof FormFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const save = async () => {
    if (!form.name.trim() || !form.youtube_url.trim() || !form.date) {
      setMessage('Nombre, URL de YouTube y fecha son obligatorios');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/streamings', {
        method: editing === 'new' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editing !== 'new' && editing ? { id: editing.id } : {}),
          ...form,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(`Error: ${data.error || res.status}`);
        return;
      }
      await fetchStreamings();
      closeForm();
    } catch {
      setMessage('Error de red al guardar');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: CmsStreamingRow) => {
    if (!window.confirm(`¿Eliminar el streaming "${s.name}"?`)) return;
    setDeletingId(s.id);
    try {
      const res = await fetch(`/api/admin/streamings?id=${encodeURIComponent(s.id)}`, {
        method: 'DELETE',
      });
      if (res.ok) setStreamings((prev) => prev.filter((x) => x.id !== s.id));
    } finally {
      setDeletingId(null);
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

  if (!isAdmin) {
    return (
      <div className="brutalist-border bg-white p-8 brutalist-shadow text-center max-w-md">
        <p className="mono text-sm uppercase">No autorizado</p>
      </div>
    );
  }

  const inputCls =
    'w-full border-4 border-black p-3 mono text-sm focus:outline-none focus:bg-yellow-50';
  const labelCls = 'block font-bold uppercase text-xs mb-1';

  return (
    <div className="w-full max-w-4xl mx-auto self-start py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/admin" className="mono text-xs uppercase underline text-gray-600 hover:text-black">
            ← Admin
          </Link>
          <h1 className="text-3xl font-black uppercase mt-1">Streamings</h1>
          <p className="mono text-sm text-gray-600">
            {streamings.length} streamings · el banner EN VIVO sale de aquí
          </p>
        </div>
        {!editing && (
          <button
            onClick={() => openForm('new')}
            className="brutalist-border bg-black text-white px-4 py-2 mono text-xs font-bold uppercase hover:bg-gray-900"
          >
            + Nuevo streaming
          </button>
        )}
      </div>

      {editing && (
        <div className="brutalist-border bg-white p-6 brutalist-shadow mb-8">
          <h2 className="text-xl font-black uppercase mb-4">
            {editing === 'new' ? 'Nuevo streaming' : `Editar: ${editing.name}`}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nombre *</label>
              <input value={form.name} onChange={set('name')} className={inputCls} placeholder="El Sótano en vivo" />
            </div>
            <div>
              <label className={labelCls}>URL de YouTube *</label>
              <input
                value={form.youtube_url}
                onChange={set('youtube_url')}
                className={inputCls}
                placeholder="https://youtube.com/watch?v=… o /live/…"
              />
            </div>
            <div>
              <label className={labelCls}>Inicio *</label>
              <input type="datetime-local" value={form.date} onChange={set('date')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Término</label>
              <input type="datetime-local" value={form.end_date} onChange={set('end_date')} className={inputCls} />
            </div>
          </div>

          <p className="mono text-xs text-gray-500 mt-3">
            El banner EN VIVO se muestra durante el día del streaming (de inicio a término).
          </p>

          {message && (
            <p className="mono text-sm font-bold uppercase mt-4 text-red-600">{message}</p>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={save}
              disabled={saving}
              className="brutalist-border bg-black text-white px-6 py-3 font-bold uppercase hover:bg-gray-900 disabled:opacity-40"
            >
              {saving ? 'Guardando…' : editing === 'new' ? 'Crear streaming' : 'Guardar cambios'}
            </button>
            <button
              onClick={closeForm}
              disabled={saving}
              className="brutalist-border bg-white px-6 py-3 font-bold uppercase hover:bg-gray-100"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loadingList ? (
        <p className="mono text-sm uppercase text-gray-500">Cargando streamings…</p>
      ) : streamings.length === 0 ? (
        <p className="mono text-sm uppercase text-gray-500">
          Sin streamings. Crea el primero con “Nuevo streaming”.
        </p>
      ) : (
        <div className="overflow-x-auto brutalist-border bg-white">
          <table className="w-full text-left mono text-sm">
            <thead className="bg-black text-white uppercase text-xs">
              <tr>
                <th className="p-3">Nombre</th>
                <th className="p-3">YouTube</th>
                <th className="p-3 whitespace-nowrap">Inicio</th>
                <th className="p-3 whitespace-nowrap">Término</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {streamings.map((s) => {
                const past = dayjs(s.end_date || s.date).isBefore(dayjs(), 'day');
                return (
                  <tr key={s.id} className={`border-t-2 border-black align-middle ${past ? 'opacity-50' : ''}`}>
                    <td className="p-3 font-bold">{s.name}</td>
                    <td className="p-3 max-w-[220px] truncate">
                      <a href={s.youtube_url} target="_blank" rel="noopener noreferrer" className="underline">
                        {s.youtube_url}
                      </a>
                    </td>
                    <td className="p-3 whitespace-nowrap">{dayjs(s.date).format('D MMM YYYY HH:mm')}</td>
                    <td className="p-3 whitespace-nowrap">
                      {s.end_date ? dayjs(s.end_date).format('D MMM YYYY HH:mm') : '—'}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => openForm(s)}
                        className="mono text-xs uppercase underline mr-3 hover:text-blue-700"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => remove(s)}
                        disabled={deletingId === s.id}
                        className="mono text-xs uppercase underline text-gray-500 hover:text-red-600 disabled:opacity-40"
                      >
                        {deletingId === s.id ? '…' : 'Borrar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
