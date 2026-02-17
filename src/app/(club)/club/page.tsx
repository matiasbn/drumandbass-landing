import type { Metadata } from 'next';
import ClubClient from './ClubClient';

export const metadata: Metadata = {
  title: 'Club',
  description: 'Experiencia virtual del club Drum and Bass Chile. Conecta con la comunidad DNB.',
  keywords: ['club drum and bass', 'club virtual DNB Chile', 'comunidad drum and bass'],
  alternates: { canonical: '/club' },
};

export default function ClubPage() {
  return <ClubClient />;
}
