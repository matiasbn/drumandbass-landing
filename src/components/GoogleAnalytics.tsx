"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";

interface GoogleAnalyticsProps {
  gaId: string;
}

function GoogleAnalyticsInner({ gaId }: GoogleAnalyticsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // La primera vista ya la envía el `gtag('config')` inline al cargar. Saltamos
  // la primera ejecución de este efecto para NO duplicar el pageview inicial;
  // las navegaciones SPA posteriores sí se envían como evento `page_view`.
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    if (typeof window.gtag !== "function") return;
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");
    window.gtag("event", "page_view", {
      page_path: url,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [pathname, searchParams, gaId]);

  // Solo renderizar en producción para no registrar visitas de desarrollo
  if (process.env.NODE_ENV !== "production") {
    return null;
  }

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}');
        `}
      </Script>
    </>
  );
}

export const GoogleAnalytics = ({ gaId }: GoogleAnalyticsProps) => (
  <Suspense fallback={null}>
    <GoogleAnalyticsInner gaId={gaId} />
  </Suspense>
);
