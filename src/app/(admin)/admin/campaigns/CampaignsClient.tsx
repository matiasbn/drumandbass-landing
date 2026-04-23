'use client';

import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import LinkExtension from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';

type AudienceKey = 'ravers' | 'registered' | 'pks';

const AUDIENCES: { key: AudienceKey; label: string }[] = [
  { key: 'ravers', label: 'Ravers (Newsletter)' },
  { key: 'registered', label: 'Usuarios Registrados' },
  { key: 'pks', label: 'DJs (Press Kit)' },
];

const STEPS = [
  { num: 1, label: 'Audiencia', desc: 'Selecciona la audiencia' },
  { num: 2, label: 'Configuracion', desc: 'Configura la campaña' },
  { num: 3, label: 'Verificacion', desc: 'Revisa y confirma' },
];

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleNextFromAudience = async () => {
    await fetchCounts();
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
          subject,
          title,
          bodyHtml,
          imageBase64: imagePreview || undefined,
          buttonText: buttonText || undefined,
          buttonUrl: buttonUrl || undefined,
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

      <Stepper current={step} />

      {/* Step 1: Audience */}
      {step === 1 && (
        <div className="brutalist-border bg-white p-6 brutalist-shadow max-w-2xl mx-auto">
          <h2 className="text-xl font-black uppercase mb-4">Seleccionar Audiencia</h2>
          <div className="space-y-3 mb-6">
            {AUDIENCES.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(key)}
                  onChange={() => toggleAudience(key)}
                  className="w-5 h-5 accent-black cursor-pointer"
                />
                <span className="font-bold uppercase text-sm">{label}</span>
              </label>
            ))}
          </div>
          {/* Individual email search */}
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

          <div className="flex justify-end mt-6">
            <button
              onClick={handleNextFromAudience}
              disabled={!hasAudience}
              className="brutalist-border bg-black text-white px-6 py-3 font-bold uppercase hover:bg-gray-900 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Configuration */}
      {step === 2 && (
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
            <div className="brutalist-border bg-gray-900 text-white p-5 space-y-4">
              {/* Subject line */}
              <p className="font-bold text-sm">
                Asunto: {subject || '(sin asunto)'}
              </p>

              {/* Email body preview */}
              <div className="bg-gray-800 p-4 space-y-4">
                {/* Image */}
                {imagePreview ? (
                  <div className="flex justify-center">
                    <img src={imagePreview} alt="Email" className="max-w-[180px] max-h-[180px] object-contain" />
                  </div>
                ) : (
                  <div className="flex justify-center">
                    <div className="w-[180px] h-[120px] bg-gray-700 flex items-center justify-center">
                      <span className="text-gray-500 text-3xl">🖼</span>
                    </div>
                  </div>
                )}

                {/* Title */}
                <h2 className="text-lg font-black leading-tight">
                  {title || 'Titulo del correo'}
                </h2>

                {/* Body */}
                <div
                  className="text-sm text-gray-300 prose prose-invert prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: bodyHtml || '<p class="text-gray-500">Contenido del correo...</p>',
                  }}
                />

                {/* CTA Button */}
                {buttonText && (
                  <div className="pt-2">
                    <span className="inline-block bg-[#ff0055] text-white font-bold uppercase text-sm px-6 py-3">
                      {buttonText}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Verification */}
      {step === 3 && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="brutalist-border bg-white p-6 brutalist-shadow">
            <h2 className="text-xl font-black uppercase mb-4">Verificacion</h2>

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
                <span>{imageFile ? imageFile.name : 'Sin imagen'}</span>
              </div>
              <div className="flex justify-between brutalist-border p-3">
                <span className="font-bold">Boton:</span>
                <span>{buttonText || 'Sin boton'} {buttonUrl ? `→ ${buttonUrl}` : ''}</span>
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
                disabled={sending || sendResult?.success === true}
                className="brutalist-border bg-[#ff0055] text-white px-6 py-3 font-bold uppercase hover:bg-[#dd0044] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sending ? 'Enviando...' : sendResult?.success ? 'Enviado' : 'Enviar Campaña'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
