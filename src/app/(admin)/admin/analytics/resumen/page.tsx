import { Metadata } from 'next';
import SummaryClient from './SummaryClient';

export const metadata: Metadata = {
  title: 'Resumen mensual - Admin - Drum and Bass Chile',
  robots: { index: false, follow: false },
};

export default function AnalyticsSummaryPage() {
  return <SummaryClient />;
}
