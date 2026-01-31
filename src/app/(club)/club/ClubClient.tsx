'use client';

import dynamic from 'next/dynamic';

const NightclubScene = dynamic(
  () => import('../../../components/club/NightclubScene'),
  { ssr: false }
);

export default function ClubClient() {
  return <NightclubScene />;
}
