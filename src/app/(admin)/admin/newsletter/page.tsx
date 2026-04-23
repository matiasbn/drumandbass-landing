import { Metadata } from 'next';
import NewsletterClient from './NewsletterClient';

export const metadata: Metadata = {
  title: 'Newsletter - Admin - Drum and Bass Chile',
  robots: { index: false, follow: false },
};

export default function NewsletterPage() {
  return <NewsletterClient />;
}
