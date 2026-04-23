import { Metadata } from 'next';
import UsersClient from './UsersClient';

export const metadata: Metadata = {
  title: 'Usuarios - Admin - Drum and Bass Chile',
  robots: { index: false, follow: false },
};

export default function UsersPage() {
  return <UsersClient />;
}
