import type { Metadata } from 'next';
import ClubClient from './ClubClient';

export const metadata: Metadata = {
  title: 'Club | Drum & Bass Chile',
  description: 'Virtual club experience - Drum & Bass Chile',
};

export default function ClubPage() {
  return <ClubClient />;
}
