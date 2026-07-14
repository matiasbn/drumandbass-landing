'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '@/src/components/admin/AdminAuthContext';
import type { AnalyticsOverview, MonthlyOverview } from '@/src/lib/ga';
import AnalyticsDashboard from '../AnalyticsDashboard';

export default function MonthlyClient() {
  const { loading, isAdmin } = useAdminAuth();
  const [months, setMonths] = useState<MonthlyOverview['months']>([]);
  const [selectedYm, setSelectedYm] = useState<string>('');
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loadingMonths, setLoadingMonths] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState('');

  // Cargar la lista de meses con datos.
  const fetchMonths = useCallback(async () => {
    setLoadingMonths(true);
    setError('');
    try {
      const res = await fetch('/api/admin/analytics/monthly', { cache: 'no-store' });
      const json = (await res.json()) as MonthlyOverview;
      if (!res.ok || !json.configured) {
        setError('No se pudieron obtener los meses.');
      } else {
        setMonths(json.months);
        // Por defecto, el mes más reciente.
        if (json.months.length) setSelectedYm(json.months[json.months.length - 1].ym);
      }
    } catch {
      setError('Error de conexión.');
    } finally {
      setLoadingMonths(false);
    }
  }, []);

  // Cargar el dashboard del mes seleccionado.
  const fetchMonthData = useCallback(async (ym: string) => {
    setLoadingData(true);
    try {
      const res = await fetch(`/api/admin/analytics?month=${ym}`, { cache: 'no-store' });
      setData(res.ok ? await res.json() : null);
    } catch {
      setData(null);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchMonths();
  }, [isAdmin, fetchMonths]);

  useEffect(() => {
    if (selectedYm) fetchMonthData(selectedYm);
  }, [selectedYm, fetchMonthData]);

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

  const selectedLabel = months.find((m) => m.ym === selectedYm)?.label ?? '';

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <Link href="/admin/analytics" className="mono text-sm text-gray-600 hover:text-black uppercase">
            &larr; Volver a Analytics
          </Link>
          <h1 className="text-3xl font-black uppercase mt-2 leading-none">Analytics por mes</h1>
          <p className="mono text-xs text-gray-500 uppercase mt-1">
            Elige un mes para ver su dashboard completo
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="mono text-xs font-bold uppercase text-gray-500">Mes:</label>
          <select
            value={selectedYm}
            onChange={(e) => setSelectedYm(e.target.value)}
            disabled={loadingMonths || months.length === 0}
            className="brutalist-border bg-white px-4 py-2 mono text-sm font-bold uppercase focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(255,0,85,1)] cursor-pointer disabled:opacity-50"
          >
            {months.length === 0 && <option>—</option>}
            {[...months].reverse().map((m) => (
              <option key={m.ym} value={m.ym}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loadingMonths ? (
        <div className="text-center py-12">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-black border-r-transparent" />
        </div>
      ) : error ? (
        <div className="brutalist-border bg-white p-6 brutalist-shadow">
          <p className="mono text-sm text-red-600 font-bold">{error}</p>
        </div>
      ) : loadingData ? (
        <div className="text-center py-12">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-black border-r-transparent" />
        </div>
      ) : data && data.configured ? (
        <AnalyticsDashboard data={data} rangeLabel={selectedLabel} zeroNote />
      ) : (
        <div className="brutalist-border bg-white p-6 brutalist-shadow">
          <p className="mono text-sm text-gray-500">Sin datos para este mes.</p>
        </div>
      )}
    </div>
  );
}
