import React from 'react';
import { Document, Page, View, Text, Image, Link, StyleSheet, Font } from '@react-pdf/renderer';
import type { Presskit } from '@/src/types/presskit';
import { socialToUrl } from '@/src/lib/socials';
import { parseRider, riderDisplay } from '@/src/lib/rider';
import { looksLikeHtml, htmlToPlainText } from '@/src/lib/mdFormat';

// PDF "enviable" del presskit: documento propio (no captura), links clickeables,
// estética brutalista de la marca. Space Mono es una de las tipografías del sitio
// (labels) y da un look técnico/brutalista coherente; se registra desde un CDN
// (TTF estático). Si la fuente no cargara, react-pdf usa el fallback base.
const MONO = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/spacemono';
Font.register({
  family: 'SpaceMono',
  fonts: [
    { src: `${MONO}/SpaceMono-Regular.ttf`, fontWeight: 'normal' },
    { src: `${MONO}/SpaceMono-Bold.ttf`, fontWeight: 'bold' },
  ],
});
Font.registerHyphenationCallback((word) => [word]); // no partir palabras

// Los <Link> del PDF necesitan URL absoluta o no son clickeables. Muchas URLs de
// mixes/links se guardan sin esquema (ej. "soundcloud.com/..."), así que la
// normalizamos (las redes ya pasan por socialToUrl, que devuelve absoluta).
function absUrl(url: string): string {
  const u = url.trim();
  if (/^https?:\/\//i.test(u)) return u;
  return `https://${u}`;
}

// Secciones de texto (bio/custom): las CHICAS se mantienen enteras (wrap={false})
// para que no se corten a mitad; las GRANDES fluyen (wrap={true}) y llenan la
// página — mantenerlas enteras las empujaría a la página siguiente y dejaría un
// hueco enorme. ~1500 chars ≈ 1/3 de página: bajo eso, mover la sección desperdicia
// poco; sobre eso, conviene que fluya.
const SECTION_SPLIT_CHARS = 1500;
const shouldSplit = (text?: string | null) => (text || '').length > SECTION_SPLIT_CHARS;

const ROSE = '#ff0055';
const BLUE = '#0000ff';
const ORANGE = '#ff5500';
const VIOLET = '#7C3AED';
const BLACK = '#000000';
const GRAY = '#666666';

const s = StyleSheet.create({
  page: { paddingHorizontal: 30, paddingTop: 30, paddingBottom: 54, fontFamily: 'SpaceMono', color: BLACK, fontSize: 9, lineHeight: 1.45 },

  // Header con sombra brutalista azul.
  headerWrap: { position: 'relative', marginBottom: 16 },
  headerShadow: { position: 'absolute', top: 7, left: 7, width: '100%', height: '100%', backgroundColor: BLUE },
  header: { flexDirection: 'row', border: `2.5pt solid ${BLACK}`, backgroundColor: '#fff' },
  photo: { width: 138, height: 156, objectFit: 'cover', borderRight: `2.5pt solid ${BLACK}` },
  photoPh: { width: 138, height: 156, borderRight: `2.5pt solid ${BLACK}`, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  headerBody: { flex: 1, paddingHorizontal: 16, paddingVertical: 14, justifyContent: 'center' },
  name: { fontFamily: 'SpaceMono', fontWeight: 'bold', fontSize: 26, textTransform: 'uppercase', letterSpacing: -1, lineHeight: 1.05 },
  roseBar: { height: 6, width: 54, backgroundColor: ROSE, marginTop: 6, marginBottom: 8 },
  realName: { fontSize: 9, color: GRAY, textTransform: 'uppercase' },
  meta: { fontSize: 9, color: GRAY, textTransform: 'uppercase', marginTop: 3 },
  genres: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  genre: { fontWeight: 'bold', fontSize: 7, textTransform: 'uppercase', backgroundColor: BLACK, color: '#fff', paddingVertical: 3, paddingHorizontal: 6, marginRight: 5, marginBottom: 5 },

  // Secciones.
  section: { marginBottom: 13 },
  h2wrap: { flexDirection: 'row', alignItems: 'center', borderBottom: `3pt solid ${BLACK}`, paddingBottom: 4, marginBottom: 7 },
  h2square: { width: 9, height: 9, backgroundColor: ROSE, marginRight: 7 },
  h2: { fontWeight: 'bold', fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  bio: { fontSize: 9.5, lineHeight: 1.6 },

  // Rider: dos columnas — nombre a la izquierda, equipo a la derecha (aprovecha
  // el espacio; el nombre ya no gasta una línea propia).
  setup: { flexDirection: 'row', alignItems: 'center', borderLeft: `4pt solid ${VIOLET}`, border: `1.2pt solid ${BLACK}`, paddingVertical: 7, paddingHorizontal: 10, marginBottom: 8 },
  setupNameCol: { width: 118, marginRight: 10 },
  setupName: { fontWeight: 'bold', fontSize: 10, textTransform: 'uppercase', backgroundColor: BLACK, color: '#fff', alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 7 },
  setupBody: { flex: 1 },
  riderRow: { flexDirection: 'row', marginBottom: 3, alignItems: 'baseline' },
  riderLabel: { fontSize: 7.5, color: GRAY, textTransform: 'uppercase', width: 90 },
  riderValue: { fontWeight: 'bold', fontSize: 10, flex: 1 },
  notes: { fontSize: 8.5, color: '#333', marginTop: 4 },

  // Items (releases / redes / links). Toda la fila es un <Link> para que el área
  // clickeable cubra el renglón completo (react-pdf ubica mal la anotación si el
  // Link es sólo el texto dentro de un flex-row con flex:1).
  item: { flexDirection: 'row', marginBottom: 4, alignItems: 'center', textDecoration: 'none' },
  chip: { fontWeight: 'bold', fontSize: 6.5, textTransform: 'uppercase', color: '#fff', paddingVertical: 2, paddingHorizontal: 4, marginRight: 7 },
  // Títulos clickeables: azul + subrayado = se leen como link (los chips aportan
  // el color de categoría; el título comunica "esto se abre").
  link: { color: BLUE, fontSize: 9.5, flex: 1, textDecoration: 'underline' },
  linkBold: { color: BLUE, fontWeight: 'bold', fontSize: 9.5, flex: 1, textDecoration: 'underline' },

  // Footer.
  footer: { position: 'absolute', bottom: 22, left: 30, right: 30, borderTop: `2.5pt solid ${BLACK}`, paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerText: { fontSize: 7.5, textTransform: 'uppercase', color: GRAY, letterSpacing: 0.5 },
});

function SectionTitle({ title }: { title: string }) {
  // minPresenceAhead evita que un encabezado quede huérfano al pie de página.
  return (
    <View style={s.h2wrap} wrap={false} minPresenceAhead={44}>
      <View style={s.h2square} />
      <Text style={s.h2}>{title}</Text>
    </View>
  );
}

// Sección de lista (rider/releases/redes/links). Dos modos según tamaño:
// - Lista CORTA (≤ atomicMax): todo junto en un bloque wrap={false} — encabezado
//   e ítems nunca se separan (evita dejar un ítem solo en otra página).
// - Lista LARGA: pega el encabezado con el PRIMER ítem (wrap={false}) y deja fluir
//   el resto; cada ítem es atómico, así ninguno se parte y el encabezado nunca
//   queda huérfano. Fluir es necesario porque no cabría entera en una página.
function BlockSection({ title, blocks, atomicMax = 8 }: { title: string; blocks: React.ReactNode[]; atomicMax?: number }) {
  if (blocks.length === 0) return null;
  if (blocks.length <= atomicMax) {
    return (
      <View style={s.section} wrap={false}>
        <SectionTitle title={title} />
        {blocks}
      </View>
    );
  }
  return (
    <View style={s.section}>
      <View wrap={false}>
        <SectionTitle title={title} />
        {blocks[0]}
      </View>
      {blocks.slice(1)}
    </View>
  );
}

export function PresskitPdf({ presskit, photoData, slug }: { presskit: Presskit; photoData?: string | null; slug?: string }) {
  // El link del footer apunta al presskit online del artista (/artistas/<slug>).
  const artistUrl = slug ? `https://drumandbasschile.cl/artistas/${slug}` : 'https://drumandbasschile.cl';
  const artistLabel = slug ? `drumandbasschile.cl/artistas/${slug}` : 'drumandbasschile.cl';
  const customSections = (presskit.custom_sections || []).filter((x) => x.title?.trim() && x.body?.trim());
  const rider = parseRider(presskit.rider);
  const riderItems = riderDisplay(rider); // controladores ya numerados ("Controlador N")
  const mixes = (presskit.mixes || []).filter((m) => m.title?.trim() && m.url?.trim());
  const socials = (presskit.socials || []).filter((so) => so.url?.trim());
  const links = (presskit.links || []).filter((l) => l.title?.trim() && l.url?.trim());
  const metaLine = [presskit.city, presskit.country].filter(Boolean).join(' · ');

  return (
    <Document title={`Presskit ${presskit.artist_name}`} author="Drum and Bass Chile">
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.headerWrap}>
          <View style={s.headerShadow} />
          <View style={s.header}>
            {photoData ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={photoData} style={s.photo} />
            ) : (
              <View style={s.photoPh}>
                <Text style={{ color: ROSE, fontSize: 8 }}>DNB CHILE</Text>
              </View>
            )}
            <View style={s.headerBody}>
              <Text style={s.name}>{presskit.artist_name}</Text>
              <View style={s.roseBar} />
              {presskit.real_name ? <Text style={s.realName}>{presskit.real_name}</Text> : null}
              {metaLine ? <Text style={s.meta}>{metaLine}</Text> : null}
              {presskit.genres?.length ? (
                <View style={s.genres}>
                  {presskit.genres.map((g) => (
                    <Text key={g} style={s.genre}>{g}</Text>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* Bio */}
        {presskit.bio ? (
          <View style={s.section} wrap={shouldSplit(presskit.bio)}>
            <SectionTitle title="Bio" />
            <Text style={s.bio}>{presskit.bio}</Text>
          </View>
        ) : null}

        {/* Secciones personalizadas (título + contenido), tras la bio. El body
            puede ser HTML (WYSIWYG) → se pasa a texto legible para el PDF. */}
        {customSections.map((sec, i) => {
          const body = looksLikeHtml(sec.body) ? htmlToPlainText(sec.body) : sec.body;
          return (
            <View key={i} style={s.section} wrap={shouldSplit(body)}>
              <SectionTitle title={sec.title} />
              <Text style={s.bio}>{body}</Text>
            </View>
          );
        })}

        {/* Rider */}
        {riderItems.length > 0 || rider.notes ? (
          <BlockSection
            title="Rider técnico"
            blocks={[
              ...riderItems.map((it, i) => (
                <View key={i} style={s.setup} wrap={false}>
                  <View style={s.setupNameCol}>
                    <Text style={s.setupName}>{it.name}</Text>
                  </View>
                  <View style={s.setupBody}>
                    {it.rows.map((r) => (
                      <View key={r.label} style={s.riderRow}>
                        <Text style={s.riderLabel}>{r.label}</Text>
                        <Text style={s.riderValue}>{r.value}</Text>
                      </View>
                    ))}
                    {it.notes ? <Text style={s.notes}>{it.notes}</Text> : null}
                  </View>
                </View>
              )),
              ...(rider.notes ? [<Text key="notes" style={s.notes}>{rider.notes}</Text>] : []),
            ]}
          />
        ) : null}

        {/* Releases */}
        <BlockSection
          title="Sets & Releases"
          blocks={mixes.map((m, i) => (
            <Link key={i} src={absUrl(m.url)} style={s.item} wrap={false}>
              <Text style={{ ...s.chip, backgroundColor: m.type === 'release' ? ORANGE : BLACK }}>
                {m.type === 'release' ? 'REL' : 'SET'}
              </Text>
              <Text style={s.linkBold}>{m.title}</Text>
            </Link>
          ))}
        />

        {/* Redes */}
        <BlockSection
          title="Redes"
          blocks={socials.map((so, i) => {
            const url = absUrl(socialToUrl(so.platform, so.url));
            return (
              <Link key={i} src={url} style={s.item} wrap={false}>
                <Text style={{ ...s.chip, backgroundColor: BLACK }}>{so.platform}</Text>
                <Text style={s.link}>{url}</Text>
              </Link>
            );
          })}
        />

        {/* Links */}
        <BlockSection
          title="Links"
          blocks={links.map((l, i) => (
            <Link key={i} src={absUrl(l.url)} style={s.item} wrap={false}>
              <Text style={{ ...s.chip, backgroundColor: ROSE }}>URL</Text>
              <Text style={s.linkBold}>{l.title}</Text>
            </Link>
          ))}
        />

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Drum and Bass Chile · Presskit</Text>
          <Link src={artistUrl} style={{ ...s.footerText, color: BLUE }}>
            {artistLabel}
          </Link>
        </View>
      </Page>
    </Document>
  );
}
