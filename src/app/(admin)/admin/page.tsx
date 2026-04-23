import { Metadata } from 'next';
import AdminClient from './AdminClient';

export const metadata: Metadata = {
  title: 'Admin - Drum and Bass Chile',
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminClient />;
}
