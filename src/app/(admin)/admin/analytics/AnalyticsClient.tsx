'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '@/src/components/admin/AdminAuthContext';
import type { AnalyticsOverview, AnalyticsNamedValue } from '@/src/lib/ga';

const RANGES = [7, 30, 90] as const;

// Si la API nativa (service account) no está configurada, caemos a un embed de
// Looker Studio cuando esta variable está seteada.
const LOOKER_URL = process.env.NEXT_PUBLIC_LOOKER_STUDIO_URL;

const fmt = (n: number) => n.toLocaleString('es-CL');

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function Scorecard({ label, value }: { label: string; value: string }) {
  return (
    <div className="brutalist-border bg-white p-4">
      <p className="mono text-[10px] font-bold uppercase text-gray-500 mb-1">{label}</p>
      <p className="text-3xl font-black">{value}</p>
    </div>
  );
}

function BarList({ title, items, empty }: { title: string; items: AnalyticsNamedValue[]; empty: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="brutalist-border bg-white p-6">
      <h2 className="text-lg font-black uppercase mb-4">{title}</h2>
      {items.length === 0 ? (
        <p className="mono text-xs text-gray-500">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={`${it.label}-${i}`} className="mono text-xs">
              <div className="flex items-center justify-between gap-3 mb-0.5">
                <span className="truncate" title={it.label}>
                  {it.label || '(vacío)'}
                </span>
                <span className="font-bold shrink-0">{fmt(it.value)}</span>
              </div>
              <div className="h-2 bg-gray-100 border border-black">
                <div className="h-full bg-[#ff0055]" style={{ width: `${(it.value / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DailyChart({ items }: { items: AnalyticsNamedValue[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="brutalist-border bg-white p-6">
      <h2 className="text-lg font-black uppercase mb-4">Usuarios activos por día</h2>
      {items.length === 0 ? (
        <p className="mono text-xs text-gray-500">Sin datos en el rango.</p>
      ) : (
        <div className="flex items-end gap-[2px] h-40">
          {items.map((it, i) => (
            <div
              key={i}
              className="flex-1 bg-black hover:bg-[#ff0055] transition-colors min-w-[2px]"
              style={{ height: `${Math.max(2, (it.value / max) * 100)}%` }}
              title={`${it.label}: ${fmt(it.value)}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

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

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <Link href="/admin" className="mono text-sm text-gray-600 hover:text-black uppercase">
            &larr; Volver al Admin
          </Link>
          <h1 className="text-3xl font-black uppercase mt-2">Analytics</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex brutalist-border">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setDays(r)}
                className={`mono text-xs font-bold uppercase px-3 py-2 border-black transition-colors ${
                  r !== RANGES[0] ? 'border-l-2' : ''
                } ${days === r ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'}`}
              >
                {r}d
              </button>
            ))}
          </div>
          <a
            href="https://analytics.google.com/"
            target="_blank"
            rel="noopener noreferrer"
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
            Dos formas de activar esta vista:
          </p>
          <ul className="mono text-sm text-gray-700 space-y-2 list-disc list-inside">
            <li>
              <strong>Embed de Looker Studio</strong> (sin service account): crea el reporte en
              Looker, <strong>Compartir → Insertar informe</strong>, copia el <code>src</code> y
              ponlo en Vercel como{' '}
              <code className="bg-gray-100 px-1 border border-gray-300">
                NEXT_PUBLIC_LOOKER_STUDIO_URL
              </code>
              .
            </li>
            <li>
              <strong>API nativa</strong> (dashboard propio): requiere una service account con
              clave — hoy bloqueada por la política de la organización. Variables{' '}
              <code className="bg-gray-100 px-1 border border-gray-300">GA_SERVICE_ACCOUNT_KEY</code>{' '}
              y{' '}
              <code className="bg-gray-100 px-1 border border-gray-300">GA_PROPERTY_ID</code> (
              <code>496543296</code>).
            </li>
          </ul>
          <p className="mono text-xs text-gray-500">
            Mientras tanto, usa el botón <strong>GA ↗</strong> para ver los datos en Google
            Analytics.
          </p>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Scorecards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Scorecard label="Usuarios activos" value={fmt(data.summary.activeUsers)} />
            <Scorecard label="Usuarios nuevos" value={fmt(data.summary.newUsers)} />
            <Scorecard label="Sesiones" value={fmt(data.summary.sessions)} />
            <Scorecard label="Vistas de página" value={fmt(data.summary.pageViews)} />
            <Scorecard
              label="Duración media"
              value={fmtDuration(data.summary.avgSessionDuration)}
            />
          </div>

          <DailyChart items={data.daily} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <BarList title="Páginas más vistas" items={data.topPages} empty="Sin datos." />
            <BarList title="Eventos" items={data.topEvents} empty="Sin datos." />
          </div>

          <BarList title="Canales de tráfico" items={data.channels} empty="Sin datos." />
        </div>
      ) : null}
    </div>
  );
}
