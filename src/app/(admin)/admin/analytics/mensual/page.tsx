import { Metadata } from 'next';
import MonthlyClient from './MonthlyClient';

export const metadata: Metadata = {
  title: 'Analytics por mes - Admin - Drum and Bass Chile',
  robots: { index: false, follow: false },
};

export default function MonthlyAnalyticsPage() {
  return <MonthlyClient />;
}
