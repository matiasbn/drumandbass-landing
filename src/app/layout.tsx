import type { Metadata } from 'next';
import { Space_Grotesk, Space_Mono } from 'next/font/google';
import { GoogleAnalytics } from '@/src/components/GoogleAnalytics';
import '../globals.css';

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  weight: ['300', '400', '700'],
});

const spaceMono = Space_Mono({
  variable: '--font-space-mono',
  subsets: ['latin'],
  weight: ['400', '700'],
});

export const metadata: Metadata = {
  title: 'Drum and Bass Chile',
  description: 'Enlaces oficiales de Drum and Bass Chile',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <html lang="es">
      {gaId && <GoogleAnalytics gaId={gaId} />}
      <body className={`${spaceGrotesk.variable} ${spaceMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
