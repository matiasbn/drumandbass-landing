// Markdown-lite para las secciones personalizadas del presskit. Se guarda como
// texto plano; el render (PresskitView) interpreta:
//   - "- " / "* " / "• " al inicio de línea → viñeta
//   - "1. " / "1) " al inicio de línea → lista numerada
//   - "**texto**" → negrita
// Degrada bien en el PDF (que muestra el texto tal cual, legible como lista).

export type MdKind = 'bold' | 'ul' | 'ol';

// Aplica el formato sobre la selección [selStart, selEnd) de `value` y devuelve
// el nuevo texto + dónde dejar el cursor. Puro (sin DOM) para testear/reusar.
export function applyMarkdown(
  value: string,
  selStart: number,
  selEnd: number,
  kind: MdKind
): { value: string; cursor: number } {
  if (kind === 'bold') {
    const sel = value.slice(selStart, selEnd) || 'texto';
    const v = value.slice(0, selStart) + '**' + sel + '**' + value.slice(selEnd);
    return { value: v, cursor: selStart + 2 + sel.length + 2 };
  }
  // ul / ol: prefija cada línea del rango (desde el inicio de la primera línea
  // tocada). Quita cualquier marcador previo para no acumular.
  const lineStart = value.lastIndexOf('\n', selStart - 1) + 1;
  const seg = value.slice(lineStart, Math.max(selEnd, selStart));
  const lines = (seg || '').split('\n');
  const prefixed = lines
    .map((l, idx) => {
      const clean = l.replace(/^\s*([-*•]|\d+[.)])\s+/, '');
      return (kind === 'ul' ? '- ' : `${idx + 1}. `) + clean;
    })
    .join('\n');
  const v = value.slice(0, lineStart) + prefixed + value.slice(Math.max(selEnd, selStart));
  return { value: v, cursor: lineStart + prefixed.length };
}

// ── HTML (WYSIWYG con tiptap) ↔ texto ────────────────────────────────────────
// Las secciones personalizadas ahora se editan con tiptap y se guardan como
// HTML. Estos helpers permiten: (a) cargar contenido viejo (texto/markdown-lite)
// en el editor, y (b) mostrarlo legible en el PDF (que no entiende HTML).

export function looksLikeHtml(s: string): boolean {
  return /<\/?(p|ul|ol|li|strong|b|em|i|u|br|h[1-6]|blockquote|a)\b/i.test(s || '');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineMdToHtml(s: string): string {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

// Convierte el markdown-lite/texto plano viejo a HTML para poder editarlo en el
// WYSIWYG sin perder viñetas, numeradas ni saltos de línea.
export function mdliteToHtml(text: string): string {
  const lines = (text || '').split('\n');
  const out: string[] = [];
  let ul: string[] = [];
  let ol: string[] = [];
  let para: string[] = [];
  const flushPara = () => {
    const j = para.join('<br>').replace(/(<br>)+$/, '');
    if (j.trim()) out.push(`<p>${j}</p>`);
    para = [];
  };
  const flushUl = () => { if (ul.length) out.push(`<ul>${ul.map((x) => `<li>${x}</li>`).join('')}</ul>`); ul = []; };
  const flushOl = () => { if (ol.length) out.push(`<ol>${ol.map((x) => `<li>${x}</li>`).join('')}</ol>`); ol = []; };
  for (const line of lines) {
    const bl = line.match(/^\s*[-*•]\s+(.*)$/);
    const nu = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bl) { flushPara(); flushOl(); ul.push(inlineMdToHtml(bl[1])); }
    else if (nu) { flushPara(); flushUl(); ol.push(inlineMdToHtml(nu[1])); }
    else { flushUl(); flushOl(); para.push(inlineMdToHtml(line)); }
  }
  flushPara();
  flushUl();
  flushOl();
  return out.join('') || '<p></p>';
}

// Convierte el HTML del WYSIWYG a texto legible para el PDF (que muestra Text
// plano): las viñetas quedan con "• ", los párrafos con saltos de línea.
export function htmlToPlainText(html: string): string {
  let s = html || '';
  s = s.replace(/<\s*br\s*\/?>/gi, '\n');
  s = s.replace(/<li[^>]*>/gi, '• ').replace(/<\/li>/gi, '\n');
  s = s.replace(/<\/(p|div|h[1-6]|blockquote|ul|ol)>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'");
  return s.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').trim();
}
