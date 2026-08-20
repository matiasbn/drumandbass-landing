import type { Metadata } from 'next';
import AdminEditClient from './AdminEditClient';

export const metadata: Metadata = {
  title: 'Editar presskit - Admin - Drum and Bass Chile',
  robots: { index: false, follow: false },
};

// Edita un presskit publicado reutilizando el MISMO editor del DJ (pk/edit) en
// modo admin (driver). Antes usaba PendingEditor; ahora es el editor unificado.
export default async function EditPresskitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminEditClient id={id} />;
}
