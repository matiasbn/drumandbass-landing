'use client';

import { useEffect, useRef, useState } from 'react';
import type { AnalyticsOverview, DailyStat } from '@/src/lib/ga';
import { fmt, eventLabel, eventTip, CORE_ACTIONS } from '@/src/lib/analyticsLabels';

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fmtDay(yyyymmdd: string): string {
  const y = yyyymmdd.slice(0, 4);
  const m = Number(yyyymmdd.slice(4, 6));
  const d = yyyymmdd.slice(6, 8);
  return `${d} ${MESES[m - 1] ?? m}/${y.slice(2)}`;
}

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

const DEVICE_LABELS: Record<string, string> = {
  mobile: 'Móvil',
  desktop: 'Escritorio',
  tablet: 'Tablet',
  smart_tv: 'Smart TV',
};
const deviceLabel = (name: string) => DEVICE_LABELS[name] ?? name;
const DEVICE_TIPS: Record<string, string> = {
  mobile: 'Visitas desde teléfonos.',
  desktop: 'Visitas desde computador (escritorio o notebook).',
  tablet: 'Visitas desde tablets.',
  smart_tv: 'Visitas desde smart TVs.',
};

const METRIC_TIPS = {
  activeUsers: 'Personas distintas que visitaron el sitio en el período elegido.',
  newUsers: 'Usuarios que visitaron el sitio por primera vez, acumulados en el período.',
  returningUsers: 'Usuarios que ya habían visitado antes y volvieron (totales − nuevos).',
  avgSessionDuration: 'Tiempo promedio que dura una visita.',
};

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

function InfoTip({ text }: { text: string }) {
  // En desktop se muestra al hover; en móvil (sin hover) se abre/cierra al tocar,
  // y se cierra al tocar fuera del tooltip.
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  return (
    <span ref={ref} className="group/tip relative inline-flex align-middle ml-1 shrink-0">
      <button
        type="button"
        aria-label="Más información"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="w-4 h-4 rounded-full border-2 border-gray-400 text-gray-400 text-[9px] font-black flex items-center justify-center cursor-help select-none hover:border-black hover:text-black group-hover/tip:border-black group-hover/tip:text-black transition-colors"
      >
        ?
      </button>
      <span
        className={`pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 ${
          open ? 'block' : 'hidden'
        } group-hover/tip:block w-56 bg-black text-white mono text-[11px] font-normal normal-case leading-snug p-2 z-30 text-left`}
      >
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

function Scorecard({ label, value, hint, tip }: { label: string; value: string; hint?: string; tip?: string }) {
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
                  <span className="font-bold text-sm flex items-center gap-1 min-w-0" title={r.sub || r.label}>
                    <span className="truncate min-w-0">{r.label || '(vacío)'}</span>
                    {r.tip && <InfoTip text={r.tip} />}
                  </span>
                  {r.sub && <span className="mono text-[10px] text-gray-400 block truncate">{r.sub}</span>}
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

function DailyChart({ items, onSelectDay }: { items: DailyStat[]; onSelectDay: (d: DailyStat) => void }) {
  const max = Math.max(1, ...items.map((i) => i.activeUsers));
  const peak = items.reduce(
    (a, b) => (b.activeUsers > a.activeUsers ? b : a),
    items[0] ?? ({ label: '', activeUsers: 0 } as DailyStat)
  );
  return (
    <div className="brutalist-border bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h2 className="text-xl font-black uppercase leading-none">
          Usuarios activos por día
          <InfoTip text="Personas distintas que visitaron el sitio cada día. Haz clic en una barra para ver TODO el dashboard de ese día." />
        </h2>
        {items.length > 0 && (
          <span className="mono text-[11px] text-gray-500 uppercase inline-flex items-center">
            Pico: <strong className="text-black mx-1">{fmt(peak.activeUsers)}</strong> · {peak.label}
            <InfoTip text="El día con más usuarios activos dentro del período." />
          </span>
        )}
      </div>
      <p className="mono text-[11px] text-gray-400 uppercase mb-4">
        Haz clic en un día para ver todo el dashboard de ese día
      </p>
      {items.length === 0 ? (
        <p className="mono text-sm text-gray-500">Sin datos en el período.</p>
      ) : (
        <>
          <div className="flex items-end gap-[3px] h-48">
            {items.map((it, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSelectDay(it)}
                aria-label={`Ver el detalle de ${it.label} (${fmt(it.activeUsers)} usuarios)`}
                className="group relative flex-1 min-w-[4px] h-full flex items-end cursor-pointer"
              >
                <div
                  className="w-full bg-black group-hover:bg-[#ff0055] transition-colors"
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
        </>
      )}
    </div>
  );
}

function CountryBars({ countries }: { countries: AnalyticsOverview['countries'] }) {
  const max = Math.max(1, ...countries.map((c) => c.total));
  return (
    <div className="brutalist-border bg-white p-6">
      <h2 className="text-xl font-black uppercase leading-none">
        Por país
        <InfoTip text="De qué país son los visitantes (total de usuarios). Debajo de cada barra, por qué canal/origen llegaron desde ese país." />
      </h2>
      <p className="mono text-[11px] text-gray-400 uppercase mt-1 mb-4">Total de usuarios y su origen</p>
      {countries.length === 0 ? (
        <p className="mono text-sm text-gray-500">Sin datos.</p>
      ) : (
        <ul className="space-y-2">
          {countries.map((c, i) => (
            <li key={`${c.label}-${i}`}>
              <div className="flex items-end justify-between gap-3 mb-0.5">
                <span className="font-bold text-sm truncate">{c.label || '(desconocido)'}</span>
                <span className="text-sm font-black shrink-0 tabular-nums">{fmt(c.total)}</span>
              </div>
              <div className="h-2.5 bg-gray-100 border-2 border-black">
                <div className="h-full bg-[#ff0055]" style={{ width: `${(c.total / max) * 100}%` }} />
              </div>
              <div className="mono text-[10px] text-gray-500 mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-0.5">
                {c.sources.map((s, j) => (
                  <span key={`${s.label}-${j}`} className="inline-flex items-center">
                    {j > 0 && <span className="mr-1 text-gray-300">·</span>}
                    {channelLabel(s.label)} <strong className="text-black ml-1">{fmt(s.value)}</strong>
                    <InfoTip text={channelTip(s.label) ?? `Canal de tráfico: ${channelLabel(s.label)}.`} />
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Scorecards({ summary, hint }: { summary: AnalyticsOverview['summary']; hint: string }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Scorecard label="Usuarios activos" value={fmt(summary.activeUsers)} hint={hint} tip={METRIC_TIPS.activeUsers} />
      <Scorecard label="Usuarios nuevos" value={fmt(summary.newUsers)} hint="Primera visita" tip={METRIC_TIPS.newUsers} />
      <Scorecard label="Usuarios que vuelven" value={fmt(summary.returningUsers)} hint="Ya habían venido" tip={METRIC_TIPS.returningUsers} />
      <Scorecard label="Duración media" value={fmtDuration(summary.avgSessionDuration)} hint="Por visita" tip={METRIC_TIPS.avgSessionDuration} />
    </div>
  );
}

function Panels({ data, zeroNote }: { data: AnalyticsOverview; zeroNote?: boolean }) {
  return (
    <>
      <CountryBars countries={data.countries} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <BarList
          title="De dónde llega la gente"
          titleTip="El canal por el que llegaron los visitantes al sitio."
          subtitle="Canales de tráfico"
          rows={data.channels
            .filter((c) => c.label !== 'Unassigned' && c.label !== 'AI Assistant')
            .map((c) => ({ label: channelLabel(c.label), value: c.value, tip: channelTip(c.label) }))}
          empty="Sin datos."
          showPercent
        />
        <BarList
          title="Por dispositivo"
          titleTip="Desde qué tipo de dispositivo visitan el sitio (móvil, escritorio, tablet)."
          subtitle="Móvil vs escritorio"
          rows={data.devices.map((d) => ({ label: deviceLabel(d.label), value: d.value, tip: DEVICE_TIPS[d.label] }))}
          empty="Sin datos."
          showPercent
        />
      </div>

      <BarList
        title="Clics a tickets por evento"
        titleTip='Cuántas personas hicieron clic en el botón "Tickets" de cada evento vigente. Necesita la custom dimension "event_title" en GA4 para contar por evento.'
        subtitle={
          data.ticketClicksAvailable
            ? 'Eventos vigentes hoy · clics a "Tickets"'
            : 'Eventos vigentes hoy · registra la custom dimension "event_title" en GA4 para contar clics'
        }
        rows={data.ticketClicks.map((t) => ({
          label: t.date ? `${t.title} · ${fmtDay(t.date.replace(/-/g, ''))}` : t.title,
          value: t.value,
          tip: 'Clics al botón "Tickets" de este evento (identificado por título + fecha).',
        }))}
        empty="No hay eventos vigentes en este momento."
        showPercent
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <BarList
          title="Acciones clave del sitio"
          titleTip={
            zeroNote
              ? 'Acciones propias del sitio. Un 0 puede significar que nadie la hizo, o que esa acción todavía no se trackeaba en esa fecha (el tracking se fue agregando con el tiempo).'
              : 'Acciones propias del sitio: junglist, tickets, El Sótano, releases, club, redes, WhatsApp.'
          }
          subtitle={zeroNote ? '0 = sin datos o aún no se trackeaba esa fecha' : 'Lo que hace la gente en el sitio'}
          rows={CORE_ACTIONS.map((name) => ({
            label: eventLabel(name),
            sub: name,
            value: data.topEvents.find((e) => e.label === name)?.value ?? 0,
            tip: eventTip(name),
          }))}
          empty="—"
        />

        <BarList
          title="Dónde visita más la gente"
          titleTip="Las páginas más vistas del sitio. Ambos dominios (drumandbasschile.cl y dnbchile.cl) se cuentan juntos por ruta."
          subtitle="Páginas más vistas del sitio"
          rows={data.topPages
            .filter((p) => {
              const clean = p.label.split('?')[0].replace(/\/$/, '') || '/';
              return clean !== '/productores' && clean !== '/organizaciones';
            })
            .map((p) => ({ label: pageLabel(p.label), sub: p.label, value: p.value, tip: pageTip(p.label) }))}
          empty="Sin datos."
          showPercent
        />
      </div>
    </>
  );
}

// Dashboard reutilizable (vista diaria y por mes). Al hacer clic en un día del
// gráfico, re-escala TODO a ese día; "Esc" o el botón vuelven al período.
export default function AnalyticsDashboard({
  data,
  rangeLabel,
  zeroNote,
}: {
  data: AnalyticsOverview;
  rangeLabel: string;
  zeroNote?: boolean;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null); // YYYYMMDD
  const [dayData, setDayData] = useState<AnalyticsOverview | null>(null);
  const [dayLoading, setDayLoading] = useState(false);

  useEffect(() => {
    if (!selectedDate) {
      setDayData(null);
      return;
    }
    let active = true;
    setDayLoading(true);
    fetch(`/api/admin/analytics?date=${selectedDate}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active) setDayData(d);
      })
      .catch(() => {
        if (active) setDayData(null);
      })
      .finally(() => {
        if (active) setDayLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedDate]);

  useEffect(() => {
    if (!selectedDate) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedDate(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedDate]);

  // Modo día
  if (selectedDate) {
    const dayLabel = fmtDay(selectedDate);
    return (
      <div className="space-y-6">
        <div className="brutalist-border bg-black text-white p-4 flex flex-wrap items-center justify-between gap-3">
          <span className="mono text-sm font-bold uppercase">
            Detalle del día · <span className="text-[#ff0055]">{dayLabel}</span>
          </span>
          <button
            onClick={() => setSelectedDate(null)}
            className="brutalist-border bg-white text-black px-4 py-2 mono text-xs font-bold uppercase hover:bg-gray-100 transition-colors"
          >
            × Volver al período (Esc)
          </button>
        </div>
        {dayLoading ? (
          <div className="text-center py-12">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-black border-r-transparent" />
          </div>
        ) : dayData && dayData.configured ? (
          <>
            <Scorecards summary={dayData.summary} hint={dayLabel} />
            <Panels data={dayData} zeroNote={zeroNote} />
          </>
        ) : (
          <p className="mono text-sm text-gray-500">No se pudieron cargar los datos de ese día.</p>
        )}
      </div>
    );
  }

  // Modo período (rango o mes)
  return (
    <div className="space-y-6">
      <Scorecards summary={data.summary} hint={rangeLabel} />
      <DailyChart items={data.daily} onSelectDay={(d) => setSelectedDate(d.date)} />
      <Panels data={data} zeroNote={zeroNote} />
    </div>
  );
}
