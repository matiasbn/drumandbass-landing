import type { Metadata } from 'next';
import AdminPendingClient from './AdminPendingClient';

export const metadata: Metadata = {
  title: 'PK pendiente - Admin - Drum and Bass Chile',
  robots: { index: false, follow: false },
};

// Crea/edita una invitación reutilizando el editor unificado (pk/edit) en modo
// admin-pending. `id` puede ser 'new' (crear) o el uuid del pendiente.
export default async function PendingPresskitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminPendingClient id={id} />;
}
