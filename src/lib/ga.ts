import { BetaAnalyticsDataClient } from '@google-analytics/data';

// Cliente de la GA4 Data API. Credenciales de una service account (con acceso
// Lector a la propiedad) guardadas como JSON en base64 en GA_SERVICE_ACCOUNT_KEY,
// más el Property ID numérico en GA_PROPERTY_ID. Devuelve null si falta config
// (para que la vista muestre instrucciones en vez de romperse).
function getClient(): { client: BetaAnalyticsDataClient; property: string } | null {
  const b64 = process.env.GA_SERVICE_ACCOUNT_KEY;
  const propertyId = process.env.GA_PROPERTY_ID;
  if (!b64 || !propertyId) return null;

  try {
    const creds = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    const client = new BetaAnalyticsDataClient({
      credentials: {
        client_email: creds.client_email,
        private_key: creds.private_key,
      },
    });
    return { client, property: `properties/${propertyId}` };
  } catch {
    return null;
  }
}

export interface AnalyticsNamedValue {
  label: string;
  value: number;
}

// Métricas por día (para el detalle al hacer clic en una barra del gráfico).
export interface DailyStat {
  label: string; // "14 jul/26"
  date: string; // "20260714"
  activeUsers: number;
  newUsers: number;
  sessions: number;
  pageViews: number;
  avgSessionDuration: number;
}

export interface AnalyticsOverview {
  configured: boolean;
  days: number;
  summary: {
    activeUsers: number;
    newUsers: number;
    returningUsers: number;
    sessions: number;
    pageViews: number;
    avgSessionDuration: number; // segundos
  };
  daily: DailyStat[]; // métricas por día
  topPages: AnalyticsNamedValue[];
  topEvents: AnalyticsNamedValue[];
  channels: AnalyticsNamedValue[];
  // Clics a tickets desglosados por evento (parámetro event_title del evento
  // event_link_click). Requiere una custom dimension "event_title" en GA4.
  ticketClicks: AnalyticsNamedValue[];
  ticketClicksAvailable: boolean;
}

const num = (v?: string | null) => (v ? Number(v) : 0);

// "20260714" → "14 jul"
function fmtDate(yyyymmdd: string): string {
  const y = yyyymmdd.slice(0, 4);
  const m = yyyymmdd.slice(4, 6);
  const d = yyyymmdd.slice(6, 8);
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${d} ${meses[Number(m) - 1] ?? m}/${y.slice(2)}`;
}

export async function getAnalyticsOverview(days = 30): Promise<AnalyticsOverview> {
  const empty: AnalyticsOverview = {
    configured: false,
    days,
    summary: { activeUsers: 0, newUsers: 0, returningUsers: 0, sessions: 0, pageViews: 0, avgSessionDuration: 0 },
    daily: [],
    topPages: [],
    topEvents: [],
    channels: [],
    ticketClicks: [],
    ticketClicksAvailable: false,
  };

  const ctx = getClient();
  if (!ctx) return empty;
  const { client, property } = ctx;
  const dateRanges = [{ startDate: `${days}daysAgo`, endDate: 'today' }];

  try {
    const [summaryRes, dailyRes, pagesRes, eventsRes, channelsRes] = await Promise.all([
      client.runReport({
        property,
        dateRanges,
        metrics: [
          { name: 'activeUsers' },
          { name: 'newUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'averageSessionDuration' },
          { name: 'totalUsers' },
        ],
      }),
      client.runReport({
        property,
        dateRanges,
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'newUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'averageSessionDuration' },
        ],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      }),
      client.runReport({
        property,
        dateRanges,
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 10,
      }),
      client.runReport({
        property,
        dateRanges,
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 30,
      }),
      client.runReport({
        property,
        dateRanges,
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 8,
      }),
    ]);

    const s = summaryRes[0].rows?.[0]?.metricValues ?? [];

    // Clics a tickets por evento: desglosa event_link_click por su parámetro
    // event_title. Requiere una custom dimension "event_title" en GA4; si no
    // existe, la API falla y devolvemos vacío sin romper el resto.
    let ticketClicks: AnalyticsNamedValue[] = [];
    let ticketClicksAvailable = false;
    try {
      const tc = await client.runReport({
        property,
        dateRanges,
        dimensions: [{ name: 'customEvent:event_title' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            stringFilter: { value: 'event_link_click' },
          },
        },
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 20,
      });
      ticketClicks = (tc[0].rows ?? [])
        .map((r) => ({
          label: r.dimensionValues?.[0]?.value ?? '',
          value: num(r.metricValues?.[0]?.value),
        }))
        .filter((r) => r.label && r.label !== '(not set)');
      ticketClicksAvailable = true;
    } catch {
      // custom dimension "event_title" no registrada aún
    }

    return {
      configured: true,
      days,
      ticketClicks,
      ticketClicksAvailable,
      summary: {
        activeUsers: num(s[0]?.value),
        newUsers: num(s[1]?.value),
        // Recurrentes = usuarios totales − nuevos, acumulados en el rango.
        returningUsers: Math.max(0, num(s[5]?.value) - num(s[1]?.value)),
        sessions: num(s[2]?.value),
        pageViews: num(s[3]?.value),
        avgSessionDuration: num(s[4]?.value),
      },
      daily: (dailyRes[0].rows ?? []).map((r) => {
        const raw = r.dimensionValues?.[0]?.value ?? '';
        const m = r.metricValues ?? [];
        return {
          label: fmtDate(raw),
          date: raw,
          activeUsers: num(m[0]?.value),
          newUsers: num(m[1]?.value),
          sessions: num(m[2]?.value),
          pageViews: num(m[3]?.value),
          avgSessionDuration: num(m[4]?.value),
        };
      }),
      topPages: (pagesRes[0].rows ?? []).map((r) => ({
        label: r.dimensionValues?.[0]?.value ?? '(desconocido)',
        value: num(r.metricValues?.[0]?.value),
      })),
      topEvents: (eventsRes[0].rows ?? []).map((r) => ({
        label: r.dimensionValues?.[0]?.value ?? '(desconocido)',
        value: num(r.metricValues?.[0]?.value),
      })),
      channels: (channelsRes[0].rows ?? []).map((r) => ({
        label: r.dimensionValues?.[0]?.value ?? '(desconocido)',
        value: num(r.metricValues?.[0]?.value),
      })),
    };
  } catch (err) {
    console.error('GA4 Data API error:', err);
    throw err;
  }
}
