'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '@/src/components/admin/AdminAuthContext';
import type { AnalyticsOverview, DailyStat } from '@/src/lib/ga';

const RANGES = [7, 30, 90] as const;

// Si la API nativa (service account) no está configurada, caemos a un embed de
// Looker Studio cuando esta variable está seteada.
const LOOKER_URL = process.env.NEXT_PUBLIC_LOOKER_STUDIO_URL;

const fmt = (n: number) => n.toLocaleString('es-CL');

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

// Nombres legibles para los eventos técnicos de GA4.
const EVENT_LABELS: Record<string, string> = {
  page_view: 'Vistas de página',
  session_start: 'Sesiones iniciadas',
  user_engagement: 'Interacción',
  first_visit: 'Primeras visitas',
  scroll: 'Scroll de página',
  click: 'Clics a enlaces externos',
  form_start: 'Formularios iniciados',
  form_submit: 'Formularios enviados',
  event_link_click: 'Clic a tickets de evento',
  button_click: 'Clics en botones',
  ui_click: 'Clics en la interfaz',
  login: 'Inicios de sesión',
};
const eventLabel = (name: string) => EVENT_LABELS[name] ?? name;

// Nombres legibles para las rutas del sitio.
const PAGE_LABELS: Record<string, string> = {
  '/': 'Inicio (eventos)',
  '/artistas': 'Artistas',
  '/junglist': 'Junglist',
  '/club': 'Club 3D',
  '/releases': 'Releases Nacionales',
  '/pk': 'Presskit — landing',
  '/pk/edit': 'Editor de presskit',
  '/organizaciones': 'Organizaciones',
  '/productores': 'Productores',
  '/privacy': 'Privacidad',
  '/terms': 'Términos',
};
function pageLabel(path: string): string {
  const clean = path.split('?')[0].replace(/\/$/, '') || '/';
  if (PAGE_LABELS[clean]) return PAGE_LABELS[clean];
  if (clean.startsWith('/pk/')) return `Presskit: ${clean.slice(4)}`;
  if (clean.startsWith('/artistas/')) return `Artista: ${clean.slice(10)}`;
  return clean;
}

// Nombres legibles para los canales de tráfico de GA4.
const CHANNEL_LABELS: Record<string, string> = {
  Direct: 'Directo',
  'Organic Social': 'Redes sociales (orgánico)',
  'Organic Search': 'Búsqueda (orgánico)',
  Referral: 'Referencia (otros sitios)',
  'Organic Video': 'Video (orgánico)',
  Email: 'Email',
  'Paid Search': 'Búsqueda (pago)',
  'Paid Social': 'Redes sociales (pago)',
  Unassigned: 'Sin asignar',
  '(direct)': 'Directo',
};
const channelLabel = (name: string) => CHANNEL_LABELS[name] ?? name;

// Explicaciones para los tooltips (qué significa cada cosa).
const CHANNEL_TIPS: Record<string, string> = {
  Direct:
    'Llegaron sin un origen rastreable: escribieron la URL, un marcador, o un link sin etiqueta (apps, algunos emails). Suele ser gente que ya conoce el sitio.',
  'Organic Social': 'Vinieron desde redes sociales (Instagram, TikTok, etc.) sin publicidad pagada.',
  'Organic Search': 'Llegaron desde resultados de buscadores (Google, etc.) sin anuncios.',
  Referral: 'Un enlace en otro sitio web los trajo hasta acá.',
  'Organic Video': 'Vinieron desde videos (YouTube, etc.) sin pago.',
  Email: 'Llegaron desde un enlace en un correo.',
  'Paid Search': 'Llegaron desde anuncios en buscadores.',
  'Paid Social': 'Llegaron desde anuncios en redes sociales.',
  Unassigned: 'GA no pudo clasificar el origen.',
};
const channelTip = (name: string) => CHANNEL_TIPS[name];

const METRIC_TIPS = {
  activeUsers: 'Personas distintas que visitaron el sitio en el rango elegido.',
  newUsers: 'Usuarios que visitaron el sitio por primera vez.',
  sessions: 'Visitas al sitio. Una sesión es una tanda de actividad; termina tras 30 min de inactividad.',
  pageViews: 'Total de páginas cargadas. Una misma persona puede ver varias.',
  avgSessionDuration: 'Tiempo promedio que dura una visita (sesión).',
};

// Qué significa cada evento de GA4.
const EVENT_TIPS: Record<string, string> = {
  page_view: 'Se registra cada vez que se carga una página.',
  session_start: 'El comienzo de una visita (sesión).',
  user_engagement: 'La persona estuvo activa/interactuando en la página.',
  first_visit: 'La primera vez que un usuario visita el sitio.',
  scroll: 'La persona hizo scroll hasta cerca del final de la página (~90%).',
  click: 'Clic a un enlace que sale del sitio (saliente).',
  form_start: 'La persona empezó a completar un formulario.',
  form_submit: 'La persona envió un formulario.',
  event_link_click: 'Clic al botón "Tickets" de un evento (evento propio del sitio).',
  button_click: 'Clic en un botón rastreado del home.',
  ui_click: 'Clic en cualquier botón o enlace del sitio (auto-tracking).',
  login: 'Inicio de sesión con Google (presskit).',
};
const eventTip = (name: string) => EVENT_TIPS[name] ?? 'Evento registrado en Google Analytics.';

// Qué es cada página del sitio.
const PAGE_TIPS: Record<string, string> = {
  '/': 'La home: eventos, comunidad, El Sótano y releases nacionales.',
  '/artistas': 'Directorio de artistas/DJs.',
  '/junglist': 'Registro y perfil de junglist.',
  '/club': 'El club 3D multijugador.',
  '/releases': 'Todos los releases nacionales.',
  '/pk': 'Landing de presskit (crear/editar).',
  '/pk/edit': 'Editor de presskit del DJ.',
  '/organizaciones': 'Directorio de organizaciones (retirado).',
  '/productores': 'Directorio de productores (retirado).',
  '/privacy': 'Política de privacidad.',
  '/terms': 'Términos y condiciones.',
};
function pageTip(path: string): string {
  const clean = path.split('?')[0].replace(/\/$/, '') || '/';
  if (PAGE_TIPS[clean]) return PAGE_TIPS[clean];
  if (clean.startsWith('/pk/')) return 'Presskit público de un DJ.';
  if (clean.startsWith('/artistas/')) return 'Perfil público de un artista.';
  return 'Vistas de esta página del sitio.';
}

// Componente de tooltip con ícono "?".
function InfoTip({ text }: { text: string }) {
  return (
    <span className="group/tip relative inline-flex align-middle ml-1">
      <span className="w-4 h-4 rounded-full border-2 border-gray-400 text-gray-400 text-[9px] font-black flex items-center justify-center cursor-help select-none group-hover/tip:border-black group-hover/tip:text-black transition-colors">
        ?
      </span>
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tip:block w-56 bg-black text-white mono text-[11px] font-normal normal-case leading-snug p-2 z-30 text-left">
        {text}
      </span>
    </span>
  );
}

interface Row {
  label: string;
  sub?: string;
  value: number;
  tip?: string;
}

function Scorecard({
  label,
  value,
  hint,
  tip,
}: {
  label: string;
  value: string;
  hint?: string;
  tip?: string;
}) {
  return (
    <div className="brutalist-border bg-white p-5">
      <p className="mono text-[11px] font-bold uppercase text-gray-500 mb-2 leading-tight">
        {label}
        {tip && <InfoTip text={tip} />}
      </p>
      <p className="text-4xl lg:text-5xl font-black leading-none tabular-nums">{value}</p>
      {hint && <p className="mono text-[10px] text-gray-400 mt-2 uppercase">{hint}</p>}
    </div>
  );
}

function BarList({
  title,
  titleTip,
  subtitle,
  rows,
  empty,
  showPercent,
}: {
  title: string;
  titleTip?: string;
  subtitle?: string;
  rows: Row[];
  empty: string;
  showPercent?: boolean;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((a, r) => a + r.value, 0);
  return (
    <div className="brutalist-border bg-white p-6">
      <h2 className="text-xl font-black uppercase leading-none">
        {title}
        {titleTip && <InfoTip text={titleTip} />}
      </h2>
      {subtitle && <p className="mono text-[11px] text-gray-400 uppercase mt-1 mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {rows.length === 0 ? (
        <p className="mono text-sm text-gray-500">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r, i) => (
            <li key={`${r.label}-${i}`}>
              <div className="flex items-end justify-between gap-3 mb-1">
                <div className="min-w-0">
                  <span className="font-bold text-sm truncate inline-flex items-center max-w-full" title={r.sub || r.label}>
                    <span className="truncate">{r.label || '(vacío)'}</span>
                    {r.tip && <InfoTip text={r.tip} />}
                  </span>
                  {r.sub && (
                    <span className="mono text-[10px] text-gray-400 block truncate">{r.sub}</span>
                  )}
                </div>
                <span className="text-sm font-black shrink-0 tabular-nums whitespace-nowrap">
                  {fmt(r.value)}
                  {showPercent && total > 0 && (
                    <span className="text-gray-400 font-bold"> · {Math.round((r.value / total) * 100)}%</span>
                  )}
                </span>
              </div>
              <div className="h-2.5 bg-gray-100 border-2 border-black">
                <div className="h-full bg-[#ff0055]" style={{ width: `${(r.value / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DayStat({ label, value, tip }: { label: string; value: string; tip?: string }) {
  return (
    <div className="border-2 border-black bg-white p-3">
      <p className="mono text-[9px] font-bold uppercase text-gray-500 mb-1 leading-tight">
        {label}
        {tip && <InfoTip text={tip} />}
      </p>
      <p className="text-2xl font-black tabular-nums leading-none">{value}</p>
    </div>
  );
}

function DailyChart({ items }: { items: DailyStat[] }) {
  const max = Math.max(1, ...items.map((i) => i.activeUsers));
  const peak = items.reduce(
    (a, b) => (b.activeUsers > a.activeUsers ? b : a),
    items[0] ?? ({ label: '', activeUsers: 0 } as DailyStat)
  );
  // Por defecto seleccionamos el día más reciente.
  const [selected, setSelected] = useState<number | null>(items.length ? items.length - 1 : null);
  const sel = selected != null ? items[selected] : null;

  return (
    <div className="brutalist-border bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h2 className="text-xl font-black uppercase leading-none">
          Usuarios activos por día
          <InfoTip text="Personas distintas que visitaron el sitio cada día. Haz clic en una barra para ver todas las métricas de ese día." />
        </h2>
        {items.length > 0 && (
          <span className="mono text-[11px] text-gray-500 uppercase">
            Pico: <strong className="text-black">{fmt(peak.activeUsers)}</strong> · {peak.label}
          </span>
        )}
      </div>
      <p className="mono text-[11px] text-gray-400 uppercase mb-4">
        Haz clic en un día para ver su detalle
      </p>
      {items.length === 0 ? (
        <p className="mono text-sm text-gray-500">Sin datos en el rango.</p>
      ) : (
        <>
          <div className="flex items-end gap-[3px] h-48">
            {items.map((it, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelected(i)}
                aria-label={`${it.label}: ${fmt(it.activeUsers)} usuarios`}
                className="group relative flex-1 min-w-[4px] h-full flex items-end cursor-pointer"
              >
                <div
                  className={`w-full transition-colors ${
                    selected === i ? 'bg-[#ff0055]' : 'bg-black group-hover:bg-[#ff0055]'
                  }`}
                  style={{ height: `${Math.max(2, (it.activeUsers / max) * 100)}%` }}
                />
                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block whitespace-nowrap bg-black text-white mono text-[10px] font-bold px-2 py-1 z-20">
                  {it.label} · {fmt(it.activeUsers)} usuarios
                </div>
              </button>
            ))}
          </div>
          <div className="flex justify-between mono text-[10px] text-gray-400 uppercase mt-2">
            <span>{items[0]?.label}</span>
            <span>{items[items.length - 1]?.label}</span>
          </div>

          {sel && (
            <div className="mt-5 pt-5 border-t-2 border-dashed border-black">
              <p className="mono text-xs font-bold uppercase mb-3">
                Detalle del <span className="text-[#ff0055]">{sel.label}</span>
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <DayStat label="Usuarios activos" value={fmt(sel.activeUsers)} tip={METRIC_TIPS.activeUsers} />
                <DayStat label="Usuarios nuevos" value={fmt(sel.newUsers)} tip={METRIC_TIPS.newUsers} />
                <DayStat label="Sesiones" value={fmt(sel.sessions)} tip={METRIC_TIPS.sessions} />
                <DayStat label="Vistas de página" value={fmt(sel.pageViews)} tip={METRIC_TIPS.pageViews} />
                <DayStat label="Duración media" value={fmtDuration(sel.avgSessionDuration)} tip={METRIC_TIPS.avgSessionDuration} />
              </div>
            </div>
          )}
        </>
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

  const rangeLabel = `Últimos ${days} días`;

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <Link href="/admin" className="mono text-sm text-gray-600 hover:text-black uppercase">
            &larr; Volver al Admin
          </Link>
          <h1 className="text-3xl font-black uppercase mt-2 leading-none">Analytics</h1>
          <p className="mono text-xs text-gray-500 uppercase mt-1">
            {rangeLabel} · Google Analytics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex brutalist-border">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setDays(r)}
                className={`mono text-xs font-bold uppercase px-4 py-2 border-black transition-colors ${
                  r !== RANGES[0] ? 'border-l-2' : ''
                } ${days === r ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'}`}
              >
                {r} días
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
            Configura la service account (variables{' '}
            <code className="bg-gray-100 px-1 border border-gray-300">GA_SERVICE_ACCOUNT_KEY</code>{' '}
            y <code className="bg-gray-100 px-1 border border-gray-300">GA_PROPERTY_ID</code>) o un
            embed de Looker (<code className="bg-gray-100 px-1 border border-gray-300">
              NEXT_PUBLIC_LOOKER_STUDIO_URL
            </code>). Mientras tanto usa el botón <strong>GA ↗</strong>.
          </p>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Scorecards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <Scorecard label="Usuarios activos" value={fmt(data.summary.activeUsers)} hint={rangeLabel} tip={METRIC_TIPS.activeUsers} />
            <Scorecard label="Usuarios nuevos" value={fmt(data.summary.newUsers)} hint="Primera visita" tip={METRIC_TIPS.newUsers} />
            <Scorecard label="Sesiones" value={fmt(data.summary.sessions)} hint="Visitas totales" tip={METRIC_TIPS.sessions} />
            <Scorecard label="Vistas de página" value={fmt(data.summary.pageViews)} hint="Páginas cargadas" tip={METRIC_TIPS.pageViews} />
            <Scorecard
              label="Duración media"
              value={fmtDuration(data.summary.avgSessionDuration)}
              hint="Por sesión"
              tip={METRIC_TIPS.avgSessionDuration}
            />
          </div>

          <DailyChart items={data.daily} />

          {/* Clics a tickets por evento — justo debajo del gráfico */}
          <BarList
            title="Clics a tickets por evento"
            titleTip='Cuántas personas hicieron clic en el botón "Tickets" de cada evento vigente. Necesita la custom dimension "event_title" en GA4 para contar por evento.'
            subtitle={
              data.ticketClicksAvailable
                ? 'Eventos vigentes hoy · clics a "Tickets" en el rango'
                : 'Eventos vigentes hoy · registra la custom dimension "event_title" en GA4 para contar clics'
            }
            rows={data.ticketClicks.map((t) => ({
              label: t.label,
              value: t.value,
              tip: 'Clics al botón "Tickets" de este evento en el rango elegido.',
            }))}
            empty="No hay eventos vigentes en este momento."
            showPercent
          />

          {/* Acciones + Canales — debajo de clics a tickets */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <BarList
              title="Acciones (eventos)"
              titleTip="Los eventos que GA registra: automáticos (vistas, scroll, clics externos) y los personalizados del sitio (login, clic a tickets, etc.)."
              subtitle="Qué hace la gente"
              rows={data.topEvents.map((e) => ({
                label: eventLabel(e.label),
                sub: e.label,
                value: e.value,
                tip: eventTip(e.label),
              }))}
              empty="Sin datos."
            />
            <BarList
              title="De dónde llega la gente"
              titleTip="El canal por el que llegaron los visitantes al sitio."
              subtitle="Canales de tráfico"
              rows={data.channels.map((c) => ({
                label: channelLabel(c.label),
                value: c.value,
                tip: channelTip(c.label),
              }))}
              empty="Sin datos."
              showPercent
            />
          </div>

          {/* Dónde visita más la gente — a ancho completo */}
          <BarList
            title="Dónde visita más la gente"
            titleTip="Las páginas más vistas del sitio. Ambos dominios (drumandbasschile.cl y dnbchile.cl) se cuentan juntos por ruta."
            subtitle="Páginas más vistas del sitio"
            rows={data.topPages.map((p) => ({
              label: pageLabel(p.label),
              sub: p.label,
              value: p.value,
              tip: pageTip(p.label),
            }))}
            empty="Sin datos."
            showPercent
          />
        </div>
      ) : null}
    </div>
  );
}
