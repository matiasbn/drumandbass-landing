import type { Metadata } from 'next';
import PendingEditor from '../../pending/[id]/PendingEditor';

export const metadata: Metadata = {
  title: 'Editar presskit - Admin - Drum and Bass Chile',
  robots: { index: false, follow: false },
};

// Reutiliza el editor COMPLETO (el mismo del flujo de pending) en modo 'presskit':
// edita un presskit ya publicado y guarda vía /api/admin/presskits.
export default function EditPresskitPage() {
  return <PendingEditor mode="presskit" />;
}
