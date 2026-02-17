import type { Metadata } from 'next';
import { Space_Grotesk, Space_Mono } from 'next/font/google';
import { GoogleAnalytics } from '@/src/components/GoogleAnalytics';
import { BASE_URL } from '@/src/constants';
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
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'Drum and Bass Chile',
    template: '%s | Drum and Bass Chile',
  },
  description: 'Comunidad oficial de Drum and Bass en Chile. Eventos, artistas, productores y organizaciones de la escena DNB chilena.',
  keywords: ['Drum and Bass', 'DNB', 'Chile', 'eventos', 'DJs', 'productores', 'bass music', 'drum and bass chile'],
  authors: [{ name: 'Drum and Bass Chile' }],
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'es_CL',
    url: BASE_URL,
    siteName: 'Drum and Bass Chile',
    title: 'Drum and Bass Chile',
    description: 'Comunidad oficial de Drum and Bass en Chile. Eventos, artistas, productores y organizaciones de la escena DNB chilena.',
    images: [
      {
        url: '/logo.png',
        width: 890,
        height: 395,
        alt: 'Drum and Bass Chile',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Drum and Bass Chile',
    description: 'Comunidad oficial de Drum and Bass en Chile. Eventos, artistas, productores y organizaciones de la escena DNB chilena.',
    images: ['/logo.png'],
  },
  alternates: {
    canonical: BASE_URL,
  },
  other: {
    'theme-color': '#000000',
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
