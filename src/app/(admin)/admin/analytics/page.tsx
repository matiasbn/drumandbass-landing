import { Metadata } from 'next';
import AnalyticsClient from './AnalyticsClient';

export const metadata: Metadata = {
  title: 'Analytics - Admin - Drum and Bass Chile',
  robots: { index: false, follow: false },
};

export default function AnalyticsPage() {
  return <AnalyticsClient />;
}
