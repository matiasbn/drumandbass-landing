'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import LinkExtension from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { buildEmailHtml } from '@/src/lib/emailTemplate';
import {
  resolveCoupon,
  segmentBody,
  segmentSubject,
  segmentHasCoupon,
  SEGMENT_LABELS,
  type Segment,
} from '@/src/lib/campaignCopy';
import dayjs from '@/src/lib/date';
import { BASE_URL } from '@/src/constants';

type AudienceKey = 'ravers' | 'registered' | 'pks' | 'junglists';

const AUDIENCES: { key: AudienceKey; label: string }[] = [
  { key: 'ravers', label: 'Ravers (Newsletter)' },
  { key: 'registered', label: 'Usuarios Registrados' },
  { key: 'pks', label: 'DJs (Press Kit)' },
  { key: 'junglists', label: 'Junglists (registro voluntario)' },
];

// Plantillas de correo. La primera rellena los campos desde un evento publicado;
// se irán agregando más (p. ej. "Nuevo capítulo de El Sótano").
type TemplateKey = 'evento';
const TEMPLATES: { key: TemplateKey; name: string; desc: string }[] = [
  {
    key: 'evento',
    name: 'Evento',
    desc: 'Invita a un evento publicado: rellena flyer, fecha y lugar. Opcionalmente con descuento Junglist.',
  },
];

// Evento (subconjunto de cms_events que trae /api/admin/events) para el picker.
interface EventLite {
  id: string;
  title: string;
  date: string;
  venue: string | null;
  address: string | null;
  flyer_url: string | null;
  tickets: string | null;
  description_html: string | null;
}

const STEPS = [
  { num: 1, label: 'Plantilla', desc: 'Elige una plantilla' },
  { num: 2, label: 'Correo', desc: 'Arma el correo' },
  { num: 3, label: 'Destinatarios', desc: 'A quién le llega' },
];

// --- Historial de campañas ---
interface CampaignSummary {
  id: string;
  name: string | null;
  template: string | null;
  subject: string;
  coupon_mode: string | null;
  coupon_new_code: string | null;
  coupon_existing_code: string | null;
  audiences: string[];
  recipients: number;
  sent_count: number;
  failed_count: number;
  status: string;
  sent_at: string | null;
  created_at: string;
}

interface CampaignRecipient {
  email: string;
  status: string;
  segment: string | null;
  opened_at: string | null;
  visited_at: string | null;
  visit_count: number;
}

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((s, i) => (
        <div key={s.num} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 flex items-center justify-center font-black text-sm brutalist-border ${
                current >= s.num ? 'bg-black text-white' : 'bg-white text-black'
              }`}
            >
              {s.num}
            </div>
            <p className="font-bold uppercase text-xs mt-1">{s.label}</p>
            <p className="mono text-[10px] text-gray-500">{s.desc}</p>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`w-12 sm:w-20 h-1 mx-2 mb-6 ${
                current > s.num ? 'bg-black' : 'bg-gray-300'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> | null }) {
  if (!editor) return null;

  const btn = (active: boolean) =>
    `px-2 py-1 text-sm font-bold cursor-pointer transition-colors ${
      active ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-200'
    }`;

  return (
    <div className="flex gap-0 border-b-4 border-black">
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive('bold'))}>B</button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive('italic'))} style={{ fontStyle: 'italic' }}>I</button>
      <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={btn(editor.isActive('underline'))} style={{ textDecoration: 'underline' }}>U</button>
      <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={btn(editor.isActive('strike'))} style={{ textDecoration: 'line-through' }}>S</button>
      <button
        type="button"
        onClick={() => {
          const url = window.prompt('URL del enlace:');
          if (url) editor.chain().focus().setLink({ href: url }).run();
          else editor.chain().focus().unsetLink().run();
        }}
        className={btn(editor.isActive('link'))}
      >
        A
      </button>
    </div>
  );
}

export default function CampaignsClient() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selected, setSelected] = useState<Set<AudienceKey>>(new Set());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [totalUnique, setTotalUnique] = useState(0);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [emailSearch, setEmailSearch] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [extraEmails, setExtraEmails] = useState<Set<string>>(new Set());

  // Campaign fields
  const [campaignName, setCampaignName] = useState('');
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [buttonText, setButtonText] = useState('');
  const [buttonUrl, setButtonUrl] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; sent: number; failed: number; errors: string[] } | null>(null);

  // Paso 1: plantilla + picker de evento.
  const [template, setTemplate] = useState<TemplateKey | 'custom' | null>(null);
  const [events, setEvents] = useState<EventLite[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [chosenEventId, setChosenEventId] = useState<string | null>(null);

  // Descuento Junglist (solo plantilla Evento): los cupones se guardan en el
  // evento y la landing los revela contra sesión. Si no hay código para junglist
  // ya registrado, a ese segmento le llega el correo normal (sin descuento).
  const [couponEnabled, setCouponEnabled] = useState(false);
  const [couponTarget, setCouponTarget] = useState<'both' | 'new_only' | 'existing_only'>('both');
  const [couponSameForAll, setCouponSameForAll] = useState(true);
  const [couponNewCode, setCouponNewCode] = useState('');
  const [couponExistingCode, setCouponExistingCode] = useState('');
  const [previewIndex, setPreviewIndex] = useState(0);

  // Vista: componer una campaña nueva o revisar el historial.
  const [view, setView] = useState<'nueva' | 'historial'>('nueva');
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [openCampaign, setOpenCampaign] = useState<CampaignSummary | null>(null);
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      LinkExtension.configure({ openOnClick: false }),
      Underline,
    ],
    content: '',
    immediatelyRender: false,
    onUpdate: ({ editor }) => setBodyHtml(editor.getHTML()),
    onCreate: ({ editor }) => setBodyHtml(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'min-h-[150px] focus:outline-none p-4 text-sm',
      },
    },
  });

  const toggleAudience = (key: AudienceKey) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const fetchCounts = useCallback(async () => {
    if (selected.size === 0) return;
    setLoadingCounts(true);
    try {
      const res = await fetch(
        `/api/admin/campaigns?audiences=${Array.from(selected).join(',')}`
      );
      const data = await res.json();
      setCounts(data.counts || {});
      setTotalUnique(data.totalUnique || 0);
    } catch {
      // ignore
    } finally {
      setLoadingCounts(false);
    }
  }, [selected]);

  // Recalcula el conteo cada vez que cambian las audiencias seleccionadas (paso 1).
  useEffect(() => {
    if (selected.size === 0) {
      setCounts({});
      setTotalUnique(0);
      return;
    }
    fetchCounts();
  }, [selected, fetchCounts]);

  const handleSearchEmail = async (query: string) => {
    setEmailSearch(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/admin/campaigns?search=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch {
      // ignore
    } finally {
      setSearchLoading(false);
    }
  };

  const addExtraEmail = (email: string) => {
    setExtraEmails(prev => new Set(prev).add(email));
    setEmailSearch('');
    setSearchResults([]);
  };

  const removeExtraEmail = (email: string) => {
    setExtraEmails(prev => {
      const next = new Set(prev);
      next.delete(email);
      return next;
    });
  };

  const hasAudience = selected.size > 0 || extraEmails.size > 0;

  // --- Paso 1: plantillas ---
  const fetchEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const res = await fetch('/api/admin/events');
      const data = await res.json();
      const now = dayjs();
      const upcoming = (data.events || []).filter((e: EventLite) => dayjs(e.date).isAfter(now));
      setEvents(upcoming);
    } catch {
      // ignore
    } finally {
      setEventsLoading(false);
    }
  }, []);

  // --- Historial ---
  const fetchCampaigns = useCallback(async () => {
    setCampaignsLoading(true);
    try {
      const res = await fetch('/api/admin/campaigns?list=1');
      const data = await res.json();
      setCampaigns(data.campaigns || []);
    } catch {
      // ignore
    } finally {
      setCampaignsLoading(false);
    }
  }, []);

  const openCampaignDetail = async (c: CampaignSummary) => {
    setOpenCampaign(c);
    setRecipients([]);
    setRecipientsLoading(true);
    try {
      const res = await fetch(`/api/admin/campaigns?campaign=${c.id}`);
      const data = await res.json();
      setRecipients(data.recipients || []);
    } catch {
      // ignore
    } finally {
      setRecipientsLoading(false);
    }
  };

  // Carga el historial al entrar a esa vista.
  useEffect(() => {
    if (view === 'historial') fetchCampaigns();
  }, [view, fetchCampaigns]);

  const chooseTemplate = (key: TemplateKey | 'custom') => {
    setTemplate(key);
    setChosenEventId(null);
    if (key === 'evento' && events.length === 0) fetchEvents();
  };

  // Rellena los campos del correo desde un evento publicado. El cuerpo va redactado
  // como invitación (sin lineup — ese ya va en el flyer) y sin lenguaje de urgencia.
  const applyEventTemplate = (ev: EventLite) => {
    const fecha = dayjs(ev.date).format('dddd D [de] MMMM [desde las] HH:mm');
    const lugar = ev.venue ? `${ev.venue}${ev.address ? ` · ${ev.address}` : ''}` : '';
    const body = [
      `<p><strong>Llegó la fecha: ${ev.title} ya es oficial y te queremos en la pista.</strong></p>`,
      `<p>Nos juntamos el <strong>${fecha}</strong>${lugar ? ` en <strong>${lugar}</strong>` : ''}. Junta a tu crew y prepárate para una noche de puro Drum and Bass.</p>`,
      `<p>Abajo encuentras el link del evento. Nos vemos en la pista.</p>`,
    ].join('');
    setCampaignName(ev.title);
    setSubject(`Nos vemos en ${ev.title}`);
    setTitle(ev.title);
    setImageFile(null);
    setImagePreview(ev.flyer_url || null);
    // El botón apunta a la landing del evento (no directo a tickets): así el ?ct
    // registra la visita en nuestra DB y el asistente ve tickets + CTAs de comunidad.
    setButtonText('Ver evento');
    setButtonUrl(`${BASE_URL}/evento/${ev.id}`);
    setBodyHtml(body);
    editor?.commands.setContent(body);
  };

  const step1Valid = template === 'custom' || (template === 'evento' && !!chosenEventId);

  const continueFromTemplate = () => {
    if (template === 'evento') {
      const ev = events.find((e) => e.id === chosenEventId);
      if (!ev) return;
      applyEventTemplate(ev);
    }
    setStep(2);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      alert('La imagen no debe superar 1 MB');
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const isStep2Valid = subject.trim() && title.trim();

  const resizeIframe = useCallback(() => {
    const iframe = iframeRef.current;
    if (iframe?.contentDocument?.body) {
      iframe.style.height = iframe.contentDocument.body.scrollHeight + 'px';
    }
  }, []);

  // Vistas previas por segmento. Si el descuento no aplica a todos, el correo
  // difiere y hay que poder revisar ambos: se muestran como carrusel.
  const previews = useMemo(() => {
    const codes = resolveCoupon({
      enabled: couponEnabled,
      target: couponTarget,
      sameForAll: couponSameForAll,
      newCode: couponNewCode,
      existingCode: couponExistingCode,
    });
    const base = bodyHtml || '<p style="color:#666;">Contenido del correo...</p>';
    const safeTitle = title || 'Titulo del correo';

    const build = (segment: Segment) => {
      const hasCoupon = segmentHasCoupon(segment, codes);
      return {
        segment,
        label: SEGMENT_LABELS[segment],
        hasCoupon,
        subject: segmentSubject(subject || '(sin asunto)', safeTitle, hasCoupon),
        html: buildEmailHtml({
          title: safeTitle,
          body: segmentBody(base, segment, hasCoupon),
          imageBase64: imagePreview || undefined,
          buttonText: buttonText || undefined,
          buttonUrl: buttonUrl || undefined,
        }),
      };
    };

    const junglist = build('junglist');
    const noJunglist = build('no_junglist');
    // Si ambos correos son idénticos, no tiene sentido el carrusel.
    return junglist.html === noJunglist.html && junglist.subject === noJunglist.subject
      ? [noJunglist]
      : [junglist, noJunglist];
  }, [
    title, bodyHtml, imagePreview, buttonText, buttonUrl, subject,
    couponEnabled, couponTarget, couponSameForAll, couponNewCode, couponExistingCode,
  ]);

  const activePreview = previews[Math.min(previewIndex, previews.length - 1)];
  const previewHtml = activePreview.html;

  useEffect(() => {
    // Resize after content updates with a small delay for render
    const timer = setTimeout(resizeIframe, 100);
    return () => clearTimeout(timer);
  }, [previewHtml, resizeIframe]);

  const handleSend = async () => {
    const totalRecipients = totalUnique + extraEmails.size;
    if (!confirm(`Estas a punto de enviar esta campaña a ${totalRecipients} destinatarios. Continuar?`)) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audiences: Array.from(selected),
          extraEmails: Array.from(extraEmails),
          name: campaignName || undefined,
          template: template || undefined,
          eventId: template === 'evento' ? chosenEventId : null,
          subject,
          title,
          bodyHtml,
          imageBase64: imagePreview || undefined,
          buttonText: buttonText || undefined,
          buttonUrl: buttonUrl || undefined,
          coupon: {
            enabled: couponEnabled,
            sameForAll: couponSameForAll,
            newCode: couponNewCode,
            existingCode: couponExistingCode,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSendResult({ success: false, sent: 0, failed: 0, errors: [data.error] });
      } else {
        setSendResult(data);
      }
    } catch (err) {
      setSendResult({ success: false, sent: 0, failed: 0, errors: [err instanceof Error ? err.message : 'Error de red'] });
    } finally {
      setSending(false);
    }
  };

  // Label helper
  const fieldLabel = (label: string, hint?: string) => (
    <div className="min-w-[160px] shrink-0">
      <p className="font-bold text-sm">{label}</p>
      {hint && <p className="mono text-[10px] text-gray-500">{hint}</p>}
    </div>
  );

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black uppercase">Campañas</h1>
          <p className="mono text-sm text-gray-600">Componer emails para la comunidad</p>
        </div>
        <Link
          href="/admin"
          className="brutalist-border bg-black text-white px-4 py-2 font-bold uppercase text-sm hover:bg-gray-900 transition-colors"
        >
          Volver
        </Link>
      </div>

      {/* Toggle Nueva / Historial */}
      <div className="flex gap-2 mb-6">
        {(['nueva', 'historial'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`brutalist-border px-4 py-2 font-bold uppercase text-sm transition-colors cursor-pointer ${
              view === v ? 'bg-[#ff0055] text-white' : 'bg-white hover:bg-gray-50'
            }`}
          >
            {v === 'nueva' ? 'Nueva campaña' : 'Historial'}
          </button>
        ))}
      </div>

      {view === 'nueva' && <Stepper current={step} />}

      {/* Step 1: Plantilla */}
      {view === 'nueva' && step === 1 && (
        <div className="brutalist-border bg-white p-6 brutalist-shadow max-w-2xl mx-auto">
          <h2 className="text-xl font-black uppercase mb-1">Elige una plantilla</h2>
          <p className="mono text-xs text-gray-500 mb-5">
            Parte desde una plantilla o arma una campaña desde cero.
          </p>

          <div className="space-y-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => chooseTemplate(t.key)}
                className={`w-full text-left brutalist-border p-4 transition-colors cursor-pointer ${
                  template === t.key ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'
                }`}
              >
                <p className="font-black uppercase">{t.name}</p>
                <p className={`mono text-xs mt-1 ${template === t.key ? 'text-gray-300' : 'text-gray-500'}`}>
                  {t.desc}
                </p>
              </button>
            ))}

            {/* Campaña personalizada, al final */}
            <button
              type="button"
              onClick={() => chooseTemplate('custom')}
              className={`w-full text-left brutalist-border border-dashed p-4 transition-colors cursor-pointer ${
                template === 'custom' ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'
              }`}
            >
              <p className="font-black uppercase">Campaña personalizada</p>
              <p className={`mono text-xs mt-1 ${template === 'custom' ? 'text-gray-300' : 'text-gray-500'}`}>
                Correo en blanco, lo armas todo tú.
              </p>
            </button>
          </div>

          {/* Picker de evento cuando la plantilla es "Evento" */}
          {template === 'evento' && (
            <div className="mt-6 pt-6 border-t-4 border-black">
              <h3 className="font-black uppercase text-sm mb-3">Elige el evento</h3>
              {eventsLoading ? (
                <p className="mono text-sm text-gray-500">Cargando eventos…</p>
              ) : events.length === 0 ? (
                <p className="mono text-sm text-gray-500">No hay eventos vigentes publicados.</p>
              ) : (
                <div className="space-y-2 max-h-[340px] overflow-y-auto">
                  {events.map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => setChosenEventId(ev.id)}
                      className={`w-full flex items-center gap-3 brutalist-border p-2 text-left transition-colors cursor-pointer ${
                        chosenEventId === ev.id ? 'bg-[#ff0055] text-white' : 'bg-white hover:bg-gray-50'
                      }`}
                    >
                      {ev.flyer_url ? (
                        <img src={ev.flyer_url} alt="" className="w-14 h-14 object-cover border-2 border-black shrink-0" />
                      ) : (
                        <div className="w-14 h-14 border-2 border-black shrink-0 flex items-center justify-center mono text-[9px] text-center">
                          SIN FLYER
                        </div>
                      )}
                      <span className="min-w-0">
                        <span className="block font-black uppercase truncate">{ev.title}</span>
                        <span className={`block mono text-[11px] ${chosenEventId === ev.id ? 'text-white' : 'text-gray-500'}`}>
                          {dayjs(ev.date).format('ddd D MMM · HH:mm')}
                          {ev.venue ? ` · ${ev.venue}` : ''}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end mt-6">
            <button
              onClick={continueFromTemplate}
              disabled={!step1Valid}
              className="brutalist-border bg-black text-white px-6 py-3 font-bold uppercase hover:bg-gray-900 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continuar →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Configuration */}
      {view === 'nueva' && step === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Form */}
          <div className="lg:col-span-3 brutalist-border bg-white p-6 brutalist-shadow">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black uppercase">Configuracion</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep(1)}
                  className="brutalist-border bg-white text-black px-4 py-2 font-bold uppercase text-sm hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!isStep2Valid}
                  className="brutalist-border bg-black text-white px-4 py-2 font-bold uppercase text-sm hover:bg-gray-900 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Siguiente →
                </button>
              </div>
            </div>

            <div className="space-y-5">
              {/* Campaign name */}
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                {fieldLabel('Nombre de la campaña', 'Para identificar internamente')}
                <input
                  type="text"
                  value={campaignName}
                  onChange={e => setCampaignName(e.target.value)}
                  placeholder="Campaña sin nombre"
                  className="flex-1 brutalist-border px-4 py-2 mono text-sm focus:outline-none"
                />
              </div>

              {/* Subject */}
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                {fieldLabel('Asunto del correo')}
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="No te pierdas el evento del año!"
                  className="flex-1 brutalist-border px-4 py-2 mono text-sm focus:outline-none"
                />
              </div>

              {/* Descuento Junglist — solo tiene sentido con un evento asociado */}
              {template === 'evento' && (
                <div className="brutalist-border p-4 bg-gray-50">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={couponEnabled}
                      onChange={e => setCouponEnabled(e.target.checked)}
                      className="w-5 h-5 accent-[#ff0055] cursor-pointer"
                    />
                    <span className="font-bold text-sm uppercase">Incluir descuento Junglist</span>
                  </label>
                  <p className="mono text-[10px] text-gray-500 mt-1 ml-8">
                    El código no viaja en el correo: se revela en la landing del evento, con sesión
                    iniciada y solo a junglists.
                  </p>

                  {couponEnabled && (
                    <div className="mt-4 ml-8 space-y-3">
                      {/* A quién le corresponde el descuento */}
                      <div className="flex flex-wrap gap-2">
                        {([
                          ['both', 'Ambos'],
                          ['new_only', 'Solo junglists nuevos'],
                          ['existing_only', 'Solo junglists ya registrados'],
                        ] as const).map(([key, label]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setCouponTarget(key)}
                            className={`brutalist-border px-3 py-2 mono text-xs font-bold uppercase transition-colors cursor-pointer ${
                              couponTarget === key ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      {couponTarget === 'both' && (
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={couponSameForAll}
                            onChange={e => setCouponSameForAll(e.target.checked)}
                            className="w-5 h-5 accent-[#ff0055] cursor-pointer"
                          />
                          <span className="font-bold text-sm">Mismo descuento para todos</span>
                        </label>
                      )}

                      {couponTarget === 'new_only' ? (
                        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                          {fieldLabel('Código junglist nuevo')}
                          <input
                            type="text"
                            value={couponNewCode}
                            onChange={e => setCouponNewCode(e.target.value)}
                            placeholder="BIENVENIDA30"
                            className="flex-1 brutalist-border px-4 py-2 mono text-sm focus:outline-none uppercase"
                          />
                        </div>
                      ) : couponTarget === 'existing_only' ? (
                        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                          {fieldLabel('Código junglist registrado')}
                          <input
                            type="text"
                            value={couponExistingCode}
                            onChange={e => setCouponExistingCode(e.target.value)}
                            placeholder="JUNGLIST20"
                            className="flex-1 brutalist-border px-4 py-2 mono text-sm focus:outline-none uppercase"
                          />
                        </div>
                      ) : couponSameForAll ? (
                        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                          {fieldLabel('Código')}
                          <input
                            type="text"
                            value={couponNewCode}
                            onChange={e => setCouponNewCode(e.target.value)}
                            placeholder="DNB2026"
                            className="flex-1 brutalist-border px-4 py-2 mono text-sm focus:outline-none uppercase"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                            {fieldLabel('Junglist nuevo', 'se inscribe con esta campaña')}
                            <input
                              type="text"
                              value={couponNewCode}
                              onChange={e => setCouponNewCode(e.target.value)}
                              placeholder="BIENVENIDA30"
                              className="flex-1 brutalist-border px-4 py-2 mono text-sm focus:outline-none uppercase"
                            />
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                            {fieldLabel('Junglist ya registrado', 'vacío = no recibe descuento')}
                            <input
                              type="text"
                              value={couponExistingCode}
                              onChange={e => setCouponExistingCode(e.target.value)}
                              placeholder="JUNGLIST20"
                              className="flex-1 brutalist-border px-4 py-2 mono text-sm focus:outline-none uppercase"
                            />
                          </div>
                        </>
                      )}

                      <p className="mono text-[10px] text-gray-600 leading-relaxed">
                        {couponTarget === 'new_only'
                          ? 'A quienes YA son junglists les llega el correo normal, sin mencionar descuento.'
                          : couponTarget === 'existing_only'
                            ? 'A quienes aún no son junglists les llega el correo normal, sin mencionar descuento.'
                            : couponSameForAll
                              ? 'Todos reciben el mismo código y un correo que anuncia el descuento.'
                              : 'Dos códigos distintos; ambos segmentos reciben un correo que anuncia su descuento.'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Image */}
              <div className="flex flex-col sm:flex-row gap-2 sm:items-start">
                {fieldLabel('Imagen del correo', '180x180 px')}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 brutalist-border border-dashed p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors min-h-[120px]"
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="max-h-[120px] object-contain" />
                  ) : (
                    <>
                      <div className="text-3xl mb-2 text-gray-400">+</div>
                      <p className="mono text-xs text-gray-500 text-center">
                        Sube un archivo o arrastralo aqui
                      </p>
                      <p className="mono text-[10px] text-gray-400">.png o .jpg de hasta 1 MB</p>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Title */}
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                {fieldLabel('Titulo del correo')}
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ultimas entradas disponibles para el evento..."
                  className="flex-1 brutalist-border px-4 py-2 mono text-sm focus:outline-none"
                />
              </div>

              {/* Body rich text */}
              <div className="flex flex-col sm:flex-row gap-2 sm:items-start">
                {fieldLabel('Contenido del correo')}
                <div className="flex-1 brutalist-border">
                  <Toolbar editor={editor} />
                  <EditorContent editor={editor} />
                </div>
              </div>

              {/* Button text */}
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                {fieldLabel('Texto del boton')}
                <input
                  type="text"
                  value={buttonText}
                  onChange={e => setButtonText(e.target.value)}
                  placeholder="RESERVA TU ENTRADA!"
                  className="flex-1 brutalist-border px-4 py-2 mono text-sm focus:outline-none"
                />
              </div>

              {/* Button URL */}
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                {fieldLabel('Enlace del boton')}
                <input
                  type="text"
                  value={buttonUrl}
                  onChange={e => setButtonUrl(e.target.value)}
                  placeholder="https://ejemplo.com/evento"
                  className="flex-1 brutalist-border px-4 py-2 mono text-sm focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="lg:col-span-2 brutalist-border bg-white p-6 brutalist-shadow h-fit lg:sticky lg:top-6">
            <h3 className="font-black uppercase text-sm mb-4">Vista previa</h3>

            {/* Con descuento parcial salen DOS correos distintos: se navegan acá
                para revisar qué le llega exactamente a cada segmento. */}
            {previews.length > 1 && (
              <div className="mb-3">
                <div className="flex gap-2">
                  {previews.map((p, i) => (
                    <button
                      key={p.segment}
                      type="button"
                      onClick={() => setPreviewIndex(i)}
                      className={`flex-1 brutalist-border px-3 py-2 mono text-[11px] font-bold uppercase transition-colors cursor-pointer ${
                        i === previewIndex ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'
                      }`}
                    >
                      {p.label}
                      <span className="block text-[9px] font-normal opacity-70">
                        {p.hasCoupon ? 'con descuento' : 'sin descuento'}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mono text-[10px] text-gray-500 mt-2">
                  Se enviarán {previews.length} correos distintos según el estado de registro.
                </p>
              </div>
            )}

            <div className="brutalist-border overflow-hidden">
              <div className="bg-black px-3 py-2">
                <p className="text-white font-bold text-xs mono">
                  Asunto: {activePreview.subject}
                </p>
              </div>
              <iframe
                ref={iframeRef}
                srcDoc={previewHtml}
                className="w-full border-0"
                onLoad={() => {
                  const iframe = iframeRef.current;
                  if (iframe?.contentDocument?.body) {
                    iframe.style.height = iframe.contentDocument.body.scrollHeight + 'px';
                  }
                }}
                title="Email preview"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Destinatarios (audiencia + envío) */}
      {view === 'nueva' && step === 3 && (
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Audiencia */}
          <div className="brutalist-border bg-white p-6 brutalist-shadow">
            <h2 className="text-xl font-black uppercase mb-4">A quién le llega</h2>
            <div className="space-y-3 mb-6">
              {AUDIENCES.map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between gap-3 cursor-pointer">
                  <span className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(key)}
                      onChange={() => toggleAudience(key)}
                      className="w-5 h-5 accent-black cursor-pointer"
                    />
                    <span className="font-bold uppercase text-sm">{label}</span>
                  </span>
                  {selected.has(key) && (
                    <span className="mono text-xs text-gray-500">
                      {loadingCounts ? '…' : `${counts[key] ?? 0}`}
                    </span>
                  )}
                </label>
              ))}
            </div>

            <div className="brutalist-border bg-black text-white px-4 py-3 flex items-center justify-between">
              <span className="mono text-xs font-bold uppercase">Total correos únicos</span>
              <span className="mono text-lg font-black">
                {loadingCounts ? '…' : totalUnique + extraEmails.size}
              </span>
            </div>

            {/* Emails individuales */}
            <div className="mt-6 pt-6 border-t-4 border-black">
              <h3 className="font-black uppercase text-sm mb-3">Agregar emails individuales</h3>
              <div className="relative">
                <input
                  type="text"
                  value={emailSearch}
                  onChange={e => handleSearchEmail(e.target.value)}
                  placeholder="Buscar por email..."
                  className="w-full brutalist-border px-4 py-2 mono text-sm focus:outline-none"
                />
                {searchLoading && (
                  <div className="absolute right-3 top-2.5">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-r-transparent" />
                  </div>
                )}
                {searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 brutalist-border bg-white max-h-[200px] overflow-y-auto">
                    {searchResults.map(email => (
                      <button
                        key={email}
                        onClick={() => addExtraEmail(email)}
                        disabled={extraEmails.has(email)}
                        className="w-full text-left px-4 py-2 mono text-sm hover:bg-gray-100 cursor-pointer disabled:text-gray-400 disabled:cursor-not-allowed border-b border-gray-200 last:border-b-0"
                      >
                        {email} {extraEmails.has(email) && '(agregado)'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {extraEmails.size > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {Array.from(extraEmails).map(email => (
                    <span
                      key={email}
                      className="brutalist-border px-3 py-1 mono text-xs bg-gray-50 flex items-center gap-2"
                    >
                      {email}
                      <button
                        onClick={() => removeExtraEmail(email)}
                        className="font-bold hover:text-red-600 cursor-pointer"
                      >
                        x
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Revisar y enviar */}
          <div className="brutalist-border bg-white p-6 brutalist-shadow">
            <h2 className="text-xl font-black uppercase mb-4">Revisar y enviar</h2>

            <div className="space-y-3 mono text-sm">
              <div className="flex justify-between brutalist-border p-3">
                <span className="font-bold">Campaña:</span>
                <span>{campaignName || '(sin nombre)'}</span>
              </div>
              <div className="flex justify-between brutalist-border p-3">
                <span className="font-bold">Asunto:</span>
                <span>{subject}</span>
              </div>
              <div className="flex justify-between brutalist-border p-3">
                <span className="font-bold">Imagen:</span>
                <span>{imageFile ? imageFile.name : imagePreview ? 'Flyer del evento' : 'Sin imagen'}</span>
              </div>
              <div className="flex justify-between brutalist-border p-3">
                <span className="font-bold">Boton:</span>
                <span>{buttonText || 'Sin boton'} {buttonUrl ? `→ ${buttonUrl}` : ''}</span>
              </div>
              <div className="brutalist-border p-3">
                <p className="font-bold mb-1">Descuento Junglist:</p>
                {!couponEnabled ? (
                  <p className="text-xs text-gray-600">Sin descuento — a todos les llega el mismo correo.</p>
                ) : (
                  <div className="text-xs space-y-1">
                    {previews.map(p => (
                      <p key={p.segment}>
                        {p.label}:{' '}
                        <strong>
                          {p.hasCoupon
                            ? p.segment === 'junglist'
                              ? couponSameForAll && couponTarget === 'both'
                                ? couponNewCode
                                : couponExistingCode
                              : couponNewCode
                            : 'sin descuento (correo normal)'}
                        </strong>
                      </p>
                    ))}
                  </div>
                )}
              </div>

              <div className="brutalist-border p-3">
                <p className="font-bold mb-2">Audiencia:</p>
                <div className="flex flex-wrap gap-2">
                  {AUDIENCES.filter(a => selected.has(a.key)).map(({ key, label }) => (
                    <span key={key} className="brutalist-border px-2 py-1 text-xs bg-gray-50">
                      {label}: {counts[key] ?? '—'}
                    </span>
                  ))}
                </div>
                {extraEmails.size > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-300">
                    <p className="font-bold mb-1">Emails individuales: {extraEmails.size}</p>
                    <div className="flex flex-wrap gap-1">
                      {Array.from(extraEmails).map(email => (
                        <span key={email} className="text-[10px] bg-gray-100 px-1">{email}</span>
                      ))}
                    </div>
                  </div>
                )}
                <p className="mt-2 font-bold">Total destinatarios unicos: {totalUnique + extraEmails.size}</p>
              </div>
            </div>

            {sendResult && (
              <div className={`brutalist-border p-4 mt-4 ${sendResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
                {sendResult.success ? (
                  <p className="font-bold text-green-800">
                    Campaña enviada exitosamente: {sendResult.sent} emails enviados
                  </p>
                ) : (
                  <div>
                    <p className="font-bold text-red-800">
                      Error al enviar: {sendResult.sent} enviados, {sendResult.failed} fallidos
                    </p>
                    {sendResult.errors.map((err, i) => (
                      <p key={i} className="mono text-xs text-red-600 mt-1">{err}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-4 mt-6">
              <button
                onClick={() => setStep(2)}
                disabled={sending}
                className="brutalist-border bg-white text-black px-6 py-3 font-bold uppercase hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-40"
              >
                ← Anterior
              </button>
              <button
                onClick={handleSend}
                disabled={sending || sendResult?.success === true || !hasAudience}
                className="brutalist-border bg-[#ff0055] text-white px-6 py-3 font-bold uppercase hover:bg-[#dd0044] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sending ? 'Enviando...' : sendResult?.success ? 'Enviado' : 'Enviar Campaña'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Historial: campañas enviadas + su tracking de aperturas/visitas */}
      {view === 'historial' && (
        <div className="brutalist-border bg-white p-6 brutalist-shadow">
          {campaignsLoading ? (
            <p className="mono text-sm text-gray-500">Cargando campañas…</p>
          ) : campaigns.length === 0 ? (
            <p className="mono text-sm text-gray-500">Todavía no hay campañas enviadas.</p>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => {
                const isOpen = openCampaign?.id === c.id;
                return (
                  <div key={c.id} className="brutalist-border">
                    <button
                      type="button"
                      onClick={() => (isOpen ? setOpenCampaign(null) : openCampaignDetail(c))}
                      className="w-full text-left p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-gray-50"
                    >
                      <div className="min-w-0">
                        <p className="font-black uppercase truncate">{c.name || c.subject}</p>
                        <p className="mono text-[11px] text-gray-500 truncate">
                          {c.subject}
                          {c.template ? ` · ${c.template}` : ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="mono text-xs font-bold">
                          {c.sent_count} enviados
                          {c.failed_count > 0 ? ` · ${c.failed_count} fallidos` : ''}
                        </p>
                        <p className="mono text-[11px] text-gray-500">
                          {dayjs(c.sent_at || c.created_at).format('DD MMM YYYY HH:mm')}
                        </p>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t-4 border-black p-4 bg-gray-50">
                        {recipientsLoading ? (
                          <p className="mono text-sm text-gray-500">Cargando destinatarios…</p>
                        ) : (
                          <>
                            <div className="flex flex-wrap gap-2 mb-3 mono text-[11px]">
                              <span className="brutalist-border px-2 py-1 bg-white">
                                Destinatarios: {recipients.length}
                              </span>
                              <span className="brutalist-border px-2 py-1 bg-white">
                                Junglists: {recipients.filter((r) => r.segment === 'junglist').length}
                              </span>
                              <span className="brutalist-border px-2 py-1 bg-white">
                                No junglists: {recipients.filter((r) => r.segment === 'no_junglist').length}
                              </span>
                              <span className="brutalist-border px-2 py-1 bg-white">
                                Abrieron: {recipients.filter((r) => r.opened_at).length}
                              </span>
                              <span className="brutalist-border px-2 py-1 bg-white">
                                Visitaron: {recipients.filter((r) => r.visited_at).length}
                              </span>
                            </div>

                            {c.coupon_mode && c.coupon_mode !== 'none' && (
                              <div className="flex flex-wrap gap-2 mb-3 mono text-[11px]">
                                <span className="brutalist-border px-2 py-1 bg-[#ff0055] text-white font-bold">
                                  {c.coupon_mode === 'single' ? 'Mismo código' : 'Códigos separados'}
                                </span>
                                {c.coupon_new_code && (
                                  <span className="brutalist-border px-2 py-1 bg-white">
                                    Nuevo: {c.coupon_new_code}
                                  </span>
                                )}
                                <span className="brutalist-border px-2 py-1 bg-white">
                                  Ya junglist: {c.coupon_existing_code || 'sin descuento'}
                                </span>
                              </div>
                            )}
                            <p className="mono text-[10px] text-gray-500 mb-2">
                              Aperturas poco fiables (los clientes de correo precargan imágenes); la
                              visita a la landing es la señal firme.
                            </p>
                            <div className="max-h-80 overflow-auto brutalist-border bg-white">
                              <table className="w-full mono text-[11px]">
                                <thead className="bg-black text-white sticky top-0">
                                  <tr>
                                    <th className="text-left p-2">Email</th>
                                    <th className="text-left p-2">Segmento</th>
                                    <th className="text-left p-2">Estado</th>
                                    <th className="text-center p-2">Abrió</th>
                                    <th className="text-center p-2">Visitó</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {recipients.map((r) => (
                                    <tr key={r.email} className="border-b border-gray-200">
                                      <td className="p-2 truncate max-w-[220px]">{r.email}</td>
                                      <td className="p-2">
                                        {r.segment === 'junglist' ? 'Junglist' : r.segment === 'no_junglist' ? 'No junglist' : '—'}
                                      </td>
                                      <td className="p-2">{r.status}</td>
                                      <td className="p-2 text-center">{r.opened_at ? '✓' : '—'}</td>
                                      <td className="p-2 text-center">
                                        {r.visited_at ? `✓${r.visit_count > 1 ? ` (${r.visit_count})` : ''}` : '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
