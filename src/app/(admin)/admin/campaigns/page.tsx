import { Metadata } from 'next';
import CampaignsClient from './CampaignsClient';

export const metadata: Metadata = {
  title: 'Campañas - Admin - Drum and Bass Chile',
  robots: { index: false, follow: false },
};

export default function CampaignsPage() {
  return <CampaignsClient />;
}
