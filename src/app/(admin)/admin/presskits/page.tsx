import { Metadata } from 'next';
import PresskitsClient from './PresskitsClient';

export const metadata: Metadata = {
  title: 'Press Kits - Admin - Drum and Bass Chile',
  robots: { index: false, follow: false },
};

export default function PresskitsPage() {
  return <PresskitsClient />;
}
