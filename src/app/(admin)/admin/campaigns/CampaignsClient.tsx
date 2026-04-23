'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import LinkExtension from '@tiptap/extension-link';

type AudienceKey = 'ravers' | 'registered' | 'pks';

const AUDIENCES: { key: AudienceKey; label: string }[] = [
  { key: 'ravers', label: 'Ravers (Newsletter)' },
  { key: 'registered', label: 'Usuarios Registrados' },
  { key: 'pks', label: 'DJs (Press Kit)' },
];

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  const btnClass = (active: boolean) =>
    `brutalist-border px-2 py-1 text-xs font-bold uppercase cursor-pointer ${
      active ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-100'
    }`;

  return (
    <div className="flex flex-wrap gap-1 mb-2">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btnClass(editor.isActive('bold'))}
      >
        B
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btnClass(editor.isActive('italic'))}
      >
        I
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={btnClass(editor.isActive('heading', { level: 2 }))}
      >
        H2
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={btnClass(editor.isActive('heading', { level: 3 }))}
      >
        H3
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btnClass(editor.isActive('bulletList'))}
      >
        Lista
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btnClass(editor.isActive('orderedList'))}
      >
        1. Lista
      </button>
      <button
        type="button"
        onClick={() => {
          const url = window.prompt('URL del enlace:');
          if (url) {
            editor.chain().focus().setLink({ href: url }).run();
          } else {
            editor.chain().focus().unsetLink().run();
          }
        }}
        className={btnClass(editor.isActive('link'))}
      >
        Link
      </button>
    </div>
  );
}

export default function CampaignsClient() {
  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<Set<AudienceKey>>(new Set());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [totalUnique, setTotalUnique] = useState(0);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [subject, setSubject] = useState('');
  const [htmlPreview, setHtmlPreview] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit,
      LinkExtension.configure({ openOnClick: false }),
    ],
    content: '<p>Escribe el contenido del email aqui...</p>',
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      setHtmlPreview(editor.getHTML());
    },
    onCreate: ({ editor }) => {
      setHtmlPreview(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[200px] focus:outline-none p-4',
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

  const handleNext = async () => {
    await fetchCounts();
    setStep(2);
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black uppercase">Campañas</h1>
          <p className="mono text-sm text-gray-600">
            Componer emails para la comunidad
          </p>
        </div>
        <Link
          href="/admin"
          className="brutalist-border bg-black text-white px-4 py-2 font-bold uppercase text-sm hover:bg-gray-900 transition-colors"
        >
          Volver
        </Link>
      </div>

      {step === 1 && (
        <div className="brutalist-border bg-white p-6 brutalist-shadow">
          <h2 className="text-xl font-black uppercase mb-4">
            Paso 1: Seleccionar Audiencia
          </h2>

          <div className="space-y-3 mb-6">
            {AUDIENCES.map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center gap-3 cursor-pointer"
              >
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

          <button
            onClick={handleNext}
            disabled={selected.size === 0}
            className="brutalist-border bg-black text-white px-6 py-3 font-bold uppercase hover:bg-gray-900 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Siguiente
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          {/* Audience summary */}
          <div className="brutalist-border bg-white p-4 brutalist-shadow">
            <h3 className="font-black uppercase text-sm mb-2">Audiencia seleccionada</h3>
            {loadingCounts ? (
              <p className="mono text-sm">Cargando...</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {AUDIENCES.filter(a => selected.has(a.key)).map(({ key, label }) => (
                  <span
                    key={key}
                    className="brutalist-border px-3 py-1 mono text-xs bg-gray-50"
                  >
                    {label}: {counts[key] ?? '—'}
                  </span>
                ))}
                <span className="brutalist-border px-3 py-1 mono text-xs bg-black text-white font-bold">
                  Total unico: {totalUnique}
                </span>
              </div>
            )}
          </div>

          {/* Subject */}
          <div className="brutalist-border bg-white p-4 brutalist-shadow">
            <label className="block font-black uppercase text-sm mb-2">
              Asunto del Email
            </label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Ej: Nuevo evento este sabado!"
              className="w-full brutalist-border px-4 py-2 mono text-sm focus:outline-none"
            />
          </div>

          {/* Editor + Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Editor */}
            <div className="brutalist-border bg-white p-4 brutalist-shadow">
              <h3 className="font-black uppercase text-sm mb-3">Contenido</h3>
              <Toolbar editor={editor} />
              <div className="brutalist-border">
                <EditorContent editor={editor} />
              </div>
            </div>

            {/* Preview */}
            <div className="brutalist-border bg-white p-4 brutalist-shadow">
              <h3 className="font-black uppercase text-sm mb-3">Preview</h3>
              <div className="brutalist-border p-4 bg-gray-50">
                <p className="mono text-xs text-gray-500 mb-1 uppercase">Asunto:</p>
                <p className="font-bold mb-4">{subject || '(sin asunto)'}</p>
                <hr className="border-black mb-4" />
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: htmlPreview,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={() => setStep(1)}
              className="brutalist-border bg-white text-black px-6 py-3 font-bold uppercase hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Volver
            </button>
            <div className="relative group">
              <button
                disabled
                className="brutalist-border bg-gray-300 text-gray-500 px-6 py-3 font-bold uppercase cursor-not-allowed"
              >
                Enviar
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block brutalist-border bg-black text-white text-xs px-3 py-1 whitespace-nowrap">
                Proximamente
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
