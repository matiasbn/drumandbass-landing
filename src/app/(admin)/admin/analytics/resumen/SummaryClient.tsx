'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '@/src/components/admin/AdminAuthContext';
import { fmt, eventLabel, CORE_ACTIONS } from '@/src/lib/analyticsLabels';
import type { MonthlyOverview } from '@/src/lib/ga';

function MonthlyChart({ months }: { months: MonthlyOverview['months'] }) {
  const max = Math.max(1, ...months.map((m) => m.activeUsers));
  return (
    <div className="brutalist-border bg-white p-6">
      <h2 className="text-xl font-black uppercase leading-none mb-4">Usuarios activos por mes</h2>
      {months.length === 0 ? (
        <p className="mono text-sm text-gray-500">Sin datos.</p>
      ) : (
        <div className="flex items-end gap-2 h-52">
          {months.map((m) => (
            <div key={m.ym} className="group relative flex-1 min-w-[10px] h-full flex flex-col justify-end items-center">
              <div
                className="w-full bg-black group-hover:bg-[#ff0055] transition-colors"
                style={{ height: `${Math.max(2, (m.activeUsers / max) * 100)}%` }}
              />
              <span className="mono text-[9px] text-gray-500 uppercase mt-1 truncate w-full text-center">
                {m.label.split(' ')[0]}
              </span>
              <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block whitespace-nowrap bg-black text-white mono text-[10px] font-bold px-2 py-1 z-20">
                {m.label} · {fmt(m.activeUsers)} usuarios
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SummaryClient() {
  const { loading, isAdmin } = useAdminAuth();
  const [data, setData] = useState<MonthlyOverview | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    setError('');
    try {
      const res = await fetch('/api/admin/analytics/monthly', { cache: 'no-store' });
      if (!res.ok) {
        setError('No se pudieron obtener los datos mensuales.');
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
    if (isAdmin) fetchData();
  }, [isAdmin, fetchData]);

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

  const summaryRows = data ? [...data.months].reverse() : [];
  const monthCols = data ? data.months.map((m) => ({ ym: m.ym, label: m.label })) : [];

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <Link href="/admin/analytics" className="mono text-sm text-gray-600 hover:text-black uppercase">
            &larr; Volver a Analytics
          </Link>
          <h1 className="text-3xl font-black uppercase mt-2 leading-none">Resumen mensual</h1>
          <p className="mono text-xs text-gray-500 uppercase mt-1">Histórico completo de Google Analytics</p>
        </div>
      </div>

      {loadingData ? (
        <div className="text-center py-12">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-black border-r-transparent" />
        </div>
      ) : error ? (
        <div className="brutalist-border bg-white p-6 brutalist-shadow">
          <p className="mono text-sm text-red-600 font-bold">{error}</p>
        </div>
      ) : data && !data.configured ? (
        <div className="brutalist-border bg-white p-6 brutalist-shadow">
          <p className="mono text-sm text-gray-700">
            Falta conectar Google Analytics (variables GA_SERVICE_ACCOUNT_KEY y GA_PROPERTY_ID).
          </p>
        </div>
      ) : data ? (
        <div className="space-y-6">
          <MonthlyChart months={data.months} />

          {/* Resumen por mes */}
          <div className="brutalist-border bg-white p-6">
            <h2 className="text-xl font-black uppercase leading-none mb-4">Resumen por mes</h2>
            <div className="overflow-x-auto">
              <table className="w-full mono text-sm border-collapse">
                <thead>
                  <tr className="border-b-4 border-black text-left">
                    <th className="py-2 pr-4 font-black uppercase">Mes</th>
                    <th className="py-2 px-3 font-black uppercase text-right">Usuarios</th>
                    <th className="py-2 px-3 font-black uppercase text-right">Nuevos</th>
                    <th className="py-2 pl-3 font-black uppercase text-right">Vuelven</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.map((m) => (
                    <tr key={m.ym} className="border-b-2 border-gray-200">
                      <td className="py-2 pr-4 font-bold uppercase whitespace-nowrap">{m.label}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{fmt(m.activeUsers)}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{fmt(m.newUsers)}</td>
                      <td className="py-2 pl-3 text-right tabular-nums">{fmt(m.returningUsers)}</td>
                    </tr>
                  ))}
                  {summaryRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-3 mono text-sm text-gray-500">
                        Sin datos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Acciones clave por mes */}
          <div className="brutalist-border bg-white p-6">
            <h2 className="text-xl font-black uppercase leading-none mb-1">Acciones clave por mes</h2>
            <p className="mono text-[11px] text-gray-400 uppercase mb-4">
              Eventos propios del sitio (0 donde aún no hay datos)
            </p>
            <div className="overflow-x-auto">
              <table className="w-full mono text-sm border-collapse">
                <thead>
                  <tr className="border-b-4 border-black text-left">
                    <th className="py-2 pr-4 font-black uppercase sticky left-0 bg-white">Acción</th>
                    {monthCols.map((c) => (
                      <th key={c.ym} className="py-2 px-3 font-black uppercase text-right whitespace-nowrap">
                        {c.label}
                      </th>
                    ))}
                    <th className="py-2 pl-3 font-black uppercase text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {CORE_ACTIONS.map((name) => {
                    const ev = data.events.find((e) => e.name === name);
                    const total = ev?.total ?? 0;
                    return (
                      <tr key={name} className="border-b-2 border-gray-200">
                        <td className="py-2 pr-4 font-bold whitespace-nowrap sticky left-0 bg-white">
                          {eventLabel(name)}
                        </td>
                        {monthCols.map((c) => (
                          <td key={c.ym} className="py-2 px-3 text-right tabular-nums">
                            {fmt(ev?.byMonth[c.ym] ?? 0)}
                          </td>
                        ))}
                        <td className="py-2 pl-3 text-right tabular-nums font-black">{fmt(total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
