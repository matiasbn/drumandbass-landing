'use client';

import { useMemo } from 'react';
import { RiLoader4Line } from '@remixicon/react';
import { useAdminAuth } from '@/src/components/admin/AdminAuthContext';
import { AdminPresskitEditor, type EditorDriver } from '@/src/app/pk/edit/page';
import type { Presskit } from '@/src/types/presskit';

// Edita un PK PUBLICADO reutilizando el editor del DJ (pk/edit) con un driver
// admin: carga/guarda vía /api/admin/presskits.
export default function AdminEditClient({ id }: { id: string }) {
  const { isAdmin, loading } = useAdminAuth();

  const driver = useMemo<EditorDriver>(
    () => ({
      kind: 'admin-pk',
      load: async () => {
        const res = await fetch('/api/admin/presskits');
        if (!res.ok) return null;
        const { presskits } = await res.json();
        const pk = (presskits || []).find((p: { id: string }) => p.id === id);
        if (!pk) return null;
        return { presskit: pk as Presskit, slug: pk.slug || '', email: pk.email || '' };
      },
      save: async (body) => {
        const res = await fetch('/api/admin/presskits', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...body }),
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, error: data.error };
        return { ok: true, presskit: data.presskit as Presskit };
      },
    }),
    [id]
  );

  if (loading) {
    return <div className="p-12 flex justify-center"><RiLoader4Line className="w-8 h-8 animate-spin" /></div>;
  }
  if (!isAdmin) {
    return <div className="p-12 text-center mono uppercase font-black">Sin acceso</div>;
  }
  return <AdminPresskitEditor driver={driver} />;
}
