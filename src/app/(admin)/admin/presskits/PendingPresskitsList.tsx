'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RiMailSendLine, RiMailCheckLine, RiDeleteBinLine, RiEdit2Line } from '@remixicon/react';
import type { PendingPresskit } from '@/src/types/pendingPresskit';

// Lista de presskits PENDIENTES (creados por admin, aún no reclamados por el DJ).
export default function PendingPresskitsList() {
  const [rows, setRows] = useState<PendingPresskit[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/pending-presskits');
      const data = await res.json();
      setRows(data.pending || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const invite = async (id: string) => {
    setBusy(id);
    try {
      const res = await fetch('/api/admin/pending-presskits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invite', id }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || 'Error enviando');
      } else {
        await load();
      }
    } finally {
      setBusy(null);
    }
  };

  const remove = async (r: PendingPresskit) => {
    const warn =
      r.status === 'claimed'
        ? 'Esto solo borra el registro pendiente. El presskit del DJ (ya publicado) NO se elimina. ¿Continuar?'
        : '¿Eliminar este presskit pendiente?';
    if (!confirm(warn)) return;
    setBusy(r.id);
    try {
      await fetch(`/api/admin/pending-presskits?id=${r.id}`, { method: 'DELETE' });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const pendientes = rows.filter((r) => r.status === 'pending');

  return (
    <div className="brutalist-border bg-white p-6 brutalist-shadow mb-8">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h2 className="text-xl font-black uppercase">
          Pendientes de aprobación {!loading && <span className="text-gray-400">({pendientes.length})</span>}
        </h2>
        <Link
          href="/admin/presskits/pending/new"
          className="mono text-xs font-black uppercase px-4 py-2 brutalist-border bg-[#ff0055] text-white hover:bg-black"
        >
          + Crear PK para un DJ
        </Link>
      </div>

      {loading ? (
        <p className="mono text-sm text-gray-500">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="mono text-sm text-gray-600">Aún no creas presskits para otros DJs. Usa &quot;Crear PK para un DJ&quot;.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 flex-wrap border-2 border-black p-3">
              <div className="flex-1 min-w-0">
                <p className="font-black uppercase truncate">{r.data?.artist_name || r.slug}</p>
                <p className="mono text-[11px] text-gray-500 truncate">
                  {r.email} · /artistas/{r.slug}
                  {r.invited_at && ' · invitado'}
                </p>
              </div>
              <span
                className={`mono text-[10px] font-black uppercase px-2 py-1 ${
                  r.status === 'claimed' ? 'bg-[#00b341] text-white' : r.status === 'cancelled' ? 'bg-gray-300' : 'bg-yellow-300'
                }`}
              >
                {r.status === 'claimed' ? 'Reclamado' : r.status === 'cancelled' ? 'Cancelado' : 'Pendiente'}
              </span>
              {r.status === 'pending' && (
                <>
                  <Link href={`/admin/presskits/pending/${r.id}`} aria-label="Editar" className="p-2 brutalist-border hover:bg-gray-100">
                    <RiEdit2Line className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => invite(r.id)}
                    disabled={busy === r.id}
                    aria-label="Enviar invitación"
                    className="p-2 brutalist-border bg-black text-white hover:bg-gray-800 disabled:opacity-50"
                  >
                    {r.invited_at ? <RiMailCheckLine className="w-4 h-4" /> : <RiMailSendLine className="w-4 h-4" />}
                  </button>
                </>
              )}
              {r.status === 'claimed' && (
                <a href={`/artistas/${r.slug}`} target="_blank" rel="noopener noreferrer" className="mono text-[11px] font-bold uppercase text-blue-700 hover:underline">
                  Ver PK
                </a>
              )}
              {/* Eliminar disponible en cualquier estado (en reclamados solo borra el registro). */}
              <button
                onClick={() => remove(r)}
                disabled={busy === r.id}
                aria-label="Eliminar registro"
                title={r.status === 'claimed' ? 'Eliminar registro (no borra el presskit publicado)' : 'Eliminar'}
                className="p-2 brutalist-border border-red-600 text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <RiDeleteBinLine className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
