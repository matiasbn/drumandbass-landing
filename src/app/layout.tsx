import type { Metadata } from "next";
import { Space_Grotesk, Space_Mono } from "next/font/google";
import { GoogleAnalytics } from "@/src/components/GoogleAnalytics";
import "../globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Drum & Bass Chile",
  description: "Enlaces oficiales de Drum & Bass Chile",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
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
      <style>{`
          body {
              font-family: var(--font-space-grotesk), sans-serif;
              background-color: #ffffff;
              color: #000000;
          }
          .mono { font-family: var(--font-space-mono), monospace; }
          .brutalist-border { border: 4px solid black; }
          .brutalist-shadow { box-shadow: 8px 8px 0px 0px rgba(0,0,0,1); }
          .brutalist-shadow-red { box-shadow: 8px 8px 0px 0px #ff0000; }
          .brutalist-shadow-blue { box-shadow: 8px 8px 0px 0px #0000ff; }
          .brutalist-shadow-green { box-shadow: 8px 8px 0px 0px #25D366; }
          .brutalist-shadow-spotify { box-shadow: 8px 8px 0px 0px #1DB954; }
          .hover-lift:hover { transform: translate(-4px, -4px); box-shadow: 12px 12px 0px 0px rgba(0,0,0,1); }
          ::selection { background: #ff0000; color: white; }
      `}
      </style>
      <body className={`${spaceGrotesk.variable} ${spaceMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
