import type { Metadata } from 'next';
import PendingEditor from './PendingEditor';

export const metadata: Metadata = {
  title: 'PK pendiente - Admin - Drum and Bass Chile',
  robots: { index: false, follow: false },
};

export default function PendingPresskitPage() {
  return <PendingEditor />;
}
