'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '@/src/components/admin/AdminAuthContext';
import type { AnalyticsOverview } from '@/src/lib/ga';
import AnalyticsDashboard from './AnalyticsDashboard';

const RANGES = [7, 30, 90] as const;

// Fallback a embed de Looker cuando la service account no está configurada.
const LOOKER_URL = process.env.NEXT_PUBLIC_LOOKER_STUDIO_URL;

export default function AnalyticsClient() {
  const { loading, isAdmin } = useAdminAuth();
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async (d: number) => {
    setLoadingData(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/analytics?days=${d}`, { cache: 'no-store' });
      if (!res.ok) {
        setError('No se pudieron obtener los datos.');
        setData(null);
      } else {
        setData(await res.json());
      }
    } catch {
      setError('Error de conexión.');
      setData(null);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchData(days);
  }, [isAdmin, days, fetchData]);

  if (loading) {
    return (
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-black border-r-transparent" />
        <p className="mt-4 mono text-sm uppercase">Cargando...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="brutalist-border bg-white p-8 brutalist-shadow text-center max-w-md">
        <p className="mono text-sm uppercase">No autorizado</p>
      </div>
    );
  }

  const rangeLabel = `Últimos ${days} días`;

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <Link href="/admin" className="mono text-sm text-gray-600 hover:text-black uppercase">
            &larr; Volver al Admin
          </Link>
          <h1 className="text-3xl font-black uppercase mt-2 leading-none">Analytics</h1>
          <p className="mono text-xs text-gray-500 uppercase mt-1">{rangeLabel} · Google Analytics</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex brutalist-border" title="Período de fechas a mostrar">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setDays(r)}
                title={`Ver los últimos ${r} días`}
                className={`mono text-xs font-bold uppercase px-4 py-2 border-black transition-colors ${
                  r !== RANGES[0] ? 'border-l-2' : ''
                } ${days === r ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'}`}
              >
                {r} días
              </button>
            ))}
          </div>
          <Link
            href="/admin/analytics/mensual"
            title="Ver un mes específico (histórico)"
            className="brutalist-border bg-white px-4 py-2 font-bold uppercase text-sm hover:bg-gray-100 transition-colors whitespace-nowrap"
          >
            Por mes
          </Link>
          <Link
            href="/admin/analytics/resumen"
            title="Ver el resumen mes a mes en tablas"
            className="brutalist-border bg-white px-4 py-2 font-bold uppercase text-sm hover:bg-gray-100 transition-colors whitespace-nowrap"
          >
            Resumen
          </Link>
          <a
            href="https://analytics.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir Google Analytics (tiempo real y más reportes)"
            className="brutalist-border bg-black text-white px-4 py-2 font-bold uppercase text-sm hover:bg-gray-900 transition-colors whitespace-nowrap"
          >
            GA ↗
          </a>
        </div>
      </div>

      {loadingData ? (
        <div className="text-center py-12">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-black border-r-transparent" />
        </div>
      ) : error ? (
        <div className="brutalist-border bg-white p-6 brutalist-shadow">
          <p className="mono text-sm text-red-600 font-bold">{error}</p>
          <p className="mono text-xs text-gray-500 mt-2">
            Revisa que la service account y las variables GA estén configuradas.
          </p>
        </div>
      ) : data && !data.configured && LOOKER_URL ? (
        <div className="brutalist-border bg-white brutalist-shadow overflow-hidden">
          <iframe
            title="Dashboard de Analytics — Drum and Bass Chile"
            src={LOOKER_URL}
            className="w-full h-[80vh] border-0"
            allowFullScreen
            sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          />
        </div>
      ) : data && !data.configured ? (
        <div className="brutalist-border bg-white p-6 lg:p-8 brutalist-shadow space-y-4">
          <h2 className="text-xl font-black uppercase">Falta conectar Google Analytics</h2>
          <p className="mono text-sm text-gray-700 leading-relaxed">
            Configura la service account (variables{' '}
            <code className="bg-gray-100 px-1 border border-gray-300">GA_SERVICE_ACCOUNT_KEY</code> y{' '}
            <code className="bg-gray-100 px-1 border border-gray-300">GA_PROPERTY_ID</code>). Mientras
            tanto usa el botón <strong>GA ↗</strong>.
          </p>
        </div>
      ) : data ? (
        <AnalyticsDashboard data={data} rangeLabel={rangeLabel} />
      ) : null}
    </div>
  );
}
