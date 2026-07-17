'use client';

/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { useAdminAuth } from '@/src/components/admin/AdminAuthContext';
import { createClient } from '@/src/lib/supabase';
import type { CmsEventRow } from '@/src/lib/cms';
import dayjs from '@/src/lib/date';

// CMS de eventos (reemplazo de Contentful): tabla cms_events + bucket 'flyers'.
// El flyer se sube directo al bucket desde el browser (la RLS de storage exige
// admin); el resto del CRUD pasa por /api/admin/events, que revalida la home.

const EMPTY_FORM = {
  title: '',
  venue: '',
  address: '',
  date: '',
  end_date: '',
  tickets: '',
  info: '',
};

type FormFields = typeof EMPTY_FORM;
type Flyer = { url: string; width: number; height: number };

const FLYER_BUCKET = 'flyers';
// Sobre este tamaño se comprime a webp (los flyers suelen venir enormes).
const MAX_FLYER_BYTES = 2 * 1024 * 1024;

function getImageSize(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen'));
    };
    img.src = url;
  });
}

function compressImage(file: File, maxWidth = 2000, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('No canvas context'));
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Compresión fallida'))),
        'image/webp',
        quality
      );
    };
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
    img.src = URL.createObjectURL(file);
  });
}

// Path dentro del bucket si la URL apunta a nuestro bucket de flyers (para
// poder borrar el archivo al reemplazarlo o eliminar el evento). URLs de otros
// orígenes devuelven null y no se tocan.
function flyerStoragePath(url: string): string | null {
  const match = url.match(new RegExp(`/object/public/${FLYER_BUCKET}/(.+?)(\\?|$)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export default function EventosClient() {
  const { loading, isAdmin } = useAdminAuth();
  const [events, setEvents] = useState<CmsEventRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  // null = solo lista · 'new' = creando · CmsEventRow = editando ese evento
  const [editing, setEditing] = useState<CmsEventRow | 'new' | null>(null);
  const [form, setForm] = useState<FormFields>(EMPTY_FORM);
  const [flyer, setFlyer] = useState<Flyer | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'min-h-[120px] focus:outline-none p-3 mono text-sm',
      },
    },
  });

  const fetchEvents = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch('/api/admin/events');
      const data = await res.json();
      if (data.events) setEvents(data.events);
    } catch {
      // ignore
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchEvents();
  }, [isAdmin, fetchEvents]);

  const openForm = (ev: CmsEventRow | 'new') => {
    setMessage('');
    setEditing(ev);
    if (ev === 'new') {
      setForm(EMPTY_FORM);
      setFlyer(null);
      editor?.commands.setContent('');
    } else {
      setForm({
        title: ev.title,
        venue: ev.venue ?? '',
        address: ev.address ?? '',
        date: ev.date,
        end_date: ev.end_date ?? '',
        tickets: ev.tickets ?? '',
        info: ev.info ?? '',
      });
      setFlyer(
        ev.flyer_url
          ? { url: ev.flyer_url, width: ev.flyer_width ?? 0, height: ev.flyer_height ?? 0 }
          : null
      );
      editor?.commands.setContent(ev.description_html ?? '');
    }
  };

  const closeForm = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFlyer(null);
    setMessage('');
  };

  const set = (key: keyof FormFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const removeStoredFlyer = async (url: string) => {
    const path = flyerStoragePath(url);
    if (!path) return;
    await createClient().storage.from(FLYER_BUCKET).remove([path]);
  };

  const handleUploadFlyer = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage('Error: solo se permiten imágenes');
      return;
    }

    setUploading(true);
    setMessage('');
    try {
      let blob: Blob = file;
      let ext = file.name.split('.').pop() || 'jpg';
      if (file.size > MAX_FLYER_BYTES) {
        blob = await compressImage(file);
        ext = 'webp';
      }
      const { width, height } = await getImageSize(blob);
      const path = `flyer-${Date.now()}.${ext}`;

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(FLYER_BUCKET)
        .upload(path, blob, { upsert: true });
      if (uploadError) {
        setMessage(`Error: ${uploadError.message}`);
        return;
      }

      const { data: { publicUrl } } = supabase.storage.from(FLYER_BUCKET).getPublicUrl(path);

      // Si había un flyer nuestro anterior, se elimina del bucket.
      if (flyer) await removeStoredFlyer(flyer.url);
      setFlyer({ url: publicUrl, width, height });
    } catch (err) {
      setMessage(`Error al subir el flyer: ${err instanceof Error ? err.message : err}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveFlyer = async () => {
    if (!flyer) return;
    await removeStoredFlyer(flyer.url);
    setFlyer(null);
  };

  const save = async () => {
    if (!form.title.trim() || !form.date) {
      setMessage('Título y fecha son obligatorios');
      return;
    }
    setSaving(true);
    setMessage('');

    const html = editor?.getHTML() ?? '';
    const payload = {
      ...(editing !== 'new' && editing ? { id: editing.id } : {}),
      ...form,
      description_html: html === '<p></p>' ? '' : html,
      flyer_url: flyer?.url ?? '',
      flyer_width: flyer?.width ?? null,
      flyer_height: flyer?.height ?? null,
    };

    try {
      const res = await fetch('/api/admin/events', {
        method: editing === 'new' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(`Error: ${data.error || res.status}`);
        return;
      }
      await fetchEvents();
      closeForm();
    } catch {
      setMessage('Error de red al guardar');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (ev: CmsEventRow) => {
    if (!window.confirm(`¿Eliminar el evento "${ev.title}"?`)) return;
    setDeletingId(ev.id);
    try {
      const res = await fetch(`/api/admin/events?id=${encodeURIComponent(ev.id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        if (ev.flyer_url) await removeStoredFlyer(ev.flyer_url);
        setEvents((prev) => prev.filter((x) => x.id !== ev.id));
      }
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
    <div className="w-full max-w-5xl mx-auto self-start py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/admin" className="mono text-xs uppercase underline text-gray-600 hover:text-black">
            ← Admin
          </Link>
          <h1 className="text-3xl font-black uppercase mt-1">Eventos</h1>
          <p className="mono text-sm text-gray-600">
            {events.length} eventos · se publican al instante en la home
          </p>
        </div>
        {!editing && (
          <button
            onClick={() => openForm('new')}
            className="brutalist-border bg-black text-white px-4 py-2 mono text-xs font-bold uppercase hover:bg-gray-900"
          >
            + Nuevo evento
          </button>
        )}
      </div>

      {editing && (
        <div className="brutalist-border bg-white p-6 brutalist-shadow mb-8">
          <h2 className="text-xl font-black uppercase mb-4">
            {editing === 'new' ? 'Nuevo evento' : `Editar: ${editing.title}`}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Título *</label>
              <input value={form.title} onChange={set('title')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Venue</label>
              <input value={form.venue} onChange={set('venue')} className={inputCls} placeholder="Club Chocolate" />
            </div>
            <div>
              <label className={labelCls}>Dirección</label>
              <input value={form.address} onChange={set('address')} className={inputCls} placeholder="Ernesto Pinto Lagarrigue 192" />
            </div>
            <div>
              <label className={labelCls}>Inicio *</label>
              <input type="datetime-local" value={form.date} onChange={set('date')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Término</label>
              <input type="datetime-local" value={form.end_date} onChange={set('end_date')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Link de tickets</label>
              <input value={form.tickets} onChange={set('tickets')} className={inputCls} placeholder="https://…" />
            </div>
            <div>
              <label className={labelCls}>Info extra</label>
              <input value={form.info} onChange={set('info')} className={inputCls} />
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>Lineup / descripción</label>
              <div className="border-4 border-black">
                {editor && (
                  <div className="flex gap-1 border-b-4 border-black bg-gray-100 p-1">
                    <button
                      type="button"
                      onClick={() => editor.chain().focus().toggleBold().run()}
                      className={`px-3 py-1 mono text-xs font-black uppercase ${editor.isActive('bold') ? 'bg-black text-white' : 'bg-white'} border-2 border-black`}
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() => editor.chain().focus().toggleItalic().run()}
                      style={{ fontStyle: 'italic' }}
                      className={`px-3 py-1 mono text-xs font-black uppercase ${editor.isActive('italic') ? 'bg-black text-white' : 'bg-white'} border-2 border-black`}
                    >
                      I
                    </button>
                  </div>
                )}
                <EditorContent editor={editor} />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>Flyer</label>
              {flyer ? (
                <div className="flex items-start gap-4">
                  <img
                    src={flyer.url}
                    alt="Flyer"
                    className="w-32 border-4 border-black object-cover"
                  />
                  <div className="flex flex-col gap-2">
                    <p className="mono text-xs text-gray-500">
                      {flyer.width}×{flyer.height}
                    </p>
                    <button
                      type="button"
                      onClick={handleRemoveFlyer}
                      className="mono text-xs uppercase underline text-gray-500 hover:text-red-600 text-left"
                    >
                      Quitar flyer
                    </button>
                  </div>
                </div>
              ) : (
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUploadFlyer}
                  disabled={uploading}
                  className="mono text-xs"
                />
              )}
              {uploading && <p className="mono text-xs uppercase mt-2">Subiendo flyer…</p>}
            </div>
          </div>

          {message && (
            <p className="mono text-sm font-bold uppercase mt-4 text-red-600">{message}</p>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={save}
              disabled={saving || uploading}
              className="brutalist-border bg-black text-white px-6 py-3 font-bold uppercase hover:bg-gray-900 disabled:opacity-40"
            >
              {saving ? 'Guardando…' : editing === 'new' ? 'Crear evento' : 'Guardar cambios'}
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
        <p className="mono text-sm uppercase text-gray-500">Cargando eventos…</p>
      ) : events.length === 0 ? (
        <p className="mono text-sm uppercase text-gray-500">
          Sin eventos. Crea el primero con “Nuevo evento”.
        </p>
      ) : (
        <div className="overflow-x-auto brutalist-border bg-white">
          <table className="w-full text-left mono text-sm">
            <thead className="bg-black text-white uppercase text-xs">
              <tr>
                <th className="p-3">Flyer</th>
                <th className="p-3">Título</th>
                <th className="p-3">Venue</th>
                <th className="p-3 whitespace-nowrap">Fecha</th>
                <th className="p-3">Tickets</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => {
                const past = dayjs(ev.end_date || ev.date).isBefore(dayjs());
                return (
                  <tr key={ev.id} className={`border-t-2 border-black align-middle ${past ? 'opacity-50' : ''}`}>
                    <td className="p-3">
                      {ev.flyer_url ? (
                        <img
                          src={ev.flyer_url}
                          alt={ev.title}
                          className="w-12 h-12 object-cover border-2 border-black"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-200 border-2 border-black flex items-center justify-center text-[8px] font-bold text-center">
                          NO FLYER
                        </div>
                      )}
                    </td>
                    <td className="p-3 font-bold">
                      {ev.title}
                      {past && <span className="ml-2 text-[10px] uppercase text-gray-500">(pasado)</span>}
                    </td>
                    <td className="p-3">{ev.venue || '—'}</td>
                    <td className="p-3 whitespace-nowrap">{dayjs(ev.date).format('D MMM YYYY HH:mm')}</td>
                    <td className="p-3">
                      {ev.tickets ? (
                        <a href={ev.tickets} target="_blank" rel="noopener noreferrer" className="underline">
                          link
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => openForm(ev)}
                        className="mono text-xs uppercase underline mr-3 hover:text-blue-700"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => remove(ev)}
                        disabled={deletingId === ev.id}
                        className="mono text-xs uppercase underline text-gray-500 hover:text-red-600 disabled:opacity-40"
                      >
                        {deletingId === ev.id ? '…' : 'Borrar'}
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
