'use client';

import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { RiBold, RiItalic, RiUnderline, RiListUnordered, RiListOrdered } from '@remixicon/react';
import { looksLikeHtml, mdliteToHtml, htmlToPlainText } from '@/src/lib/mdFormat';

// Editor visual (WYSIWYG) para las secciones personalizadas del presskit.
// Guarda HTML. Acepta contenido viejo (texto/markdown-lite) y lo convierte a
// HTML al cargarlo, así se puede seguir editando sin perder formato.
export default function RichTextEditor({
  value,
  onChange,
  minHeight = 100,
}: {
  value: string;
  onChange: (html: string) => void;
  minHeight?: number;
}) {
  const lastEmitted = useRef<string | null>(null);

  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: looksLikeHtml(value) ? value : mdliteToHtml(value),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: `focus:outline-none p-3 mono text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-2 [&_strong]:font-black`,
        style: `min-height:${minHeight}px`,
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // Si no hay texto real (p.ej. "<p></p>"), emitimos "" para que la sección
      // se trate como vacía en los filtros de guardado/render.
      const clean = htmlToPlainText(html).trim() ? html : '';
      lastEmitted.current = clean;
      onChange(clean);
    },
  });

  // Sincroniza cambios externos (p.ej. carga inicial async) sin romper el cursor
  // ni entrar en loop: solo re-setea si el valor no vino de nuestro propio emit.
  useEffect(() => {
    if (!editor) return;
    if (value !== lastEmitted.current) {
      const html = looksLikeHtml(value) ? value : mdliteToHtml(value);
      if (html !== editor.getHTML()) editor.commands.setContent(html, { emitUpdate: false });
      lastEmitted.current = value;
    }
  }, [value, editor]);

  if (!editor) return null;

  const Btn = ({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`px-2.5 py-1 brutalist-border inline-flex items-center ${active ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'}`}
    >
      {children}
    </button>
  );

  return (
    <div className="brutalist-border bg-white">
      <div className="flex flex-wrap gap-1 border-b-2 border-black bg-gray-100 p-1">
        <Btn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrita"><RiBold className="w-3.5 h-3.5" /></Btn>
        <Btn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Cursiva"><RiItalic className="w-3.5 h-3.5" /></Btn>
        <Btn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Subrayado"><RiUnderline className="w-3.5 h-3.5" /></Btn>
        <span className="w-px bg-black/20 mx-0.5" />
        <Btn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Viñetas"><RiListUnordered className="w-3.5 h-3.5" /></Btn>
        <Btn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada"><RiListOrdered className="w-3.5 h-3.5" /></Btn>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
