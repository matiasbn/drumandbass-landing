'use client';

import { useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { RiLoader4Line } from '@remixicon/react';
import { useAdminAuth } from '@/src/components/admin/AdminAuthContext';
import { AdminPresskitEditor, type EditorDriver } from '@/src/app/pk/edit/page';
import { pendingToPresskit } from '@/src/types/pendingPresskit';
import type { PendingPresskitData } from '@/src/types/pendingPresskit';

// Crea/edita una INVITACIÓN de presskit (pending_presskits) reutilizando el
// editor del DJ (pk/edit) con un driver admin. id='new' → crea al primer guardado.
export default function AdminPendingClient({ id: routeId }: { id: string }) {
  const { isAdmin, loading } = useAdminAuth();
  const router = useRouter();
  const idRef = useRef<string | null>(routeId === 'new' ? null : routeId);

  const driver = useMemo<EditorDriver>(
    () => ({
      kind: 'admin-pending',
      load: async () => {
        if (!idRef.current) return { presskit: null, slug: '', email: '' };
        const res = await fetch(`/api/admin/pending-presskits?id=${idRef.current}`);
        if (!res.ok) return null;
        const { pending } = await res.json();
        if (!pending) return null;
        return {
          presskit: pendingToPresskit((pending.data || {}) as PendingPresskitData),
          slug: pending.slug || '',
          email: pending.email || '',
        };
      },
      save: async (body, { slug, email }) => {
        if (!email.trim() || !slug.trim()) {
          return { ok: false, error: 'Faltan email y slug de la invitación' };
        }
        // body → data del pendiente (se ignora `published`, no aplica a invitaciones).
        const { published: _published, ...data } = body as Record<string, unknown>;
        void _published;
        const method = idRef.current ? 'PUT' : 'POST';
        const res = await fetch('/api/admin/pending-presskits', {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: idRef.current, email: email.trim(), slug: slug.trim(), data }),
        });
        const d = await res.json();
        if (!res.ok) return { ok: false, error: d.error };
        const newId = d.pending?.id as string | undefined;
        if (newId && !idRef.current) {
          idRef.current = newId;
          // Reemplaza 'new' por el id real en la URL (sin recargar el editor).
          router.replace(`/admin/presskits/pending/${newId}`);
        }
        return { ok: true, slug };
      },
      invite: async () => {
        if (!idRef.current) return { ok: false, error: 'Guarda la invitación primero' };
        const res = await fetch('/api/admin/pending-presskits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'invite', id: idRef.current }),
        });
        const d = await res.json();
        return res.ok ? { ok: true } : { ok: false, error: d.error };
      },
    }),
    [router]
  );

  if (loading) {
    return <div className="p-12 flex justify-center"><RiLoader4Line className="w-8 h-8 animate-spin" /></div>;
  }
  if (!isAdmin) {
    return <div className="p-12 text-center mono uppercase font-black">Sin acceso</div>;
  }
  return <AdminPresskitEditor driver={driver} />;
}
