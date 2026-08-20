import { notFound } from 'next/navigation';
import { createSupabaseServer } from '@/src/lib/supabase-server';
import { verifyAdmin } from '@/src/lib/authz';
import { pendingToPresskit } from '@/src/types/pendingPresskit';
import type { PendingPresskitData } from '@/src/types/pendingPresskit';
import PresskitView from '@/src/components/pk/PresskitView';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string }> };

export default async function PresskitPreviewPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServer();

  // Gate admin: solo un admin puede previsualizar un presskit no publicado.
  const { isAdmin } = await verifyAdmin(supabase);
  if (!isAdmin) notFound();

  const { data: pending } = await supabase
    .from('pending_presskits')
    .select('slug, data, status')
    .eq('id', id)
    .single();

  if (!pending) notFound();

  const presskit = pendingToPresskit(pending.data as PendingPresskitData);
  const label =
    pending.status === 'claimed'
      ? 'Ya reclamado por el DJ'
      : pending.status === 'cancelled'
        ? 'Invitación cancelada'
        : 'Pendiente de aprobación del DJ';

  return (
    <main className="flex-1">
      {/* Aviso fijo: esto es una vista previa, no el presskit publicado. */}
      <div className="sticky top-0 z-50 bg-[#ff0055] text-white brutalist-border border-t-0 border-l-0 border-r-0 px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        <p className="mono text-xs font-black uppercase">
          Vista previa · así lo verá el DJ · {label}
        </p>
        <span className="mono text-[10px] font-bold uppercase opacity-80">/{pending.slug}</span>
      </div>
      <PresskitView presskit={presskit} slug={pending.slug} preview />
    </main>
  );
}
