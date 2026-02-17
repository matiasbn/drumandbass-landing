import type { Metadata } from 'next';
import ClubClient from './ClubClient';

export const metadata: Metadata = {
  title: 'Club | Drum and Bass Chile',
  description: 'Virtual club experience - Drum and Bass Chile',
};

export default function ClubPage() {
  return <ClubClient />;
}
