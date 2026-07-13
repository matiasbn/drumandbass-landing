import type { Metadata } from 'next';

import JunglistClient from './JunglistClient';

export const metadata: Metadata = {
  title: 'Junglist',
  description:
    'Inscríbete como miembro oficial de Drum and Bass Chile y accede a beneficios exclusivos.',
  alternates: { canonical: '/junglist' },
};

export default function JunglistPage() {
  return <JunglistClient />;
}
