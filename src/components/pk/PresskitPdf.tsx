import React from 'react';
import { Document, Page, View, Text, Image, Link, StyleSheet, Font } from '@react-pdf/renderer';
import type { Presskit } from '@/src/types/presskit';
import { socialToUrl } from '@/src/lib/socials';
import { parseRider, setupRows, riderIsEmpty } from '@/src/lib/rider';

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
  h2: { fontWeight: 'bold', fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  bio: { fontSize: 9.5, lineHeight: 1.6 },

  // Rider.
  setup: { borderLeft: `4pt solid ${VIOLET}`, border: `1.2pt solid ${BLACK}`, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 8 },
  setupName: { fontWeight: 'bold', fontSize: 10, textTransform: 'uppercase', marginBottom: 5, backgroundColor: BLACK, color: '#fff', alignSelf: 'flex-start', paddingVertical: 2, paddingHorizontal: 6 },
  riderRow: { flexDirection: 'row', marginBottom: 3, alignItems: 'baseline' },
  riderLabel: { fontSize: 7.5, color: GRAY, textTransform: 'uppercase', width: 96 },
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

export function PresskitPdf({ presskit, photoData }: { presskit: Presskit; photoData?: string | null }) {
  const rider = parseRider(presskit.rider);
  const riderSetups = rider.setups.filter((x) => setupRows(x).length > 0 || x.notes);
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
          <View style={s.section}>
            <SectionTitle title="Bio" />
            <Text style={s.bio}>{presskit.bio}</Text>
          </View>
        ) : null}

        {/* Rider */}
        {!riderIsEmpty(rider) ? (
          <View style={s.section}>
            <SectionTitle title="Rider técnico" />
            {riderSetups.map((setup, i) => (
              <View key={i} style={s.setup} wrap={false}>
                <Text style={s.setupName}>{setup.name || `Setup ${i + 1}`}</Text>
                {setupRows(setup).map((r) => (
                  <View key={r.label} style={s.riderRow}>
                    <Text style={s.riderLabel}>{r.label}</Text>
                    <Text style={s.riderValue}>{r.value}</Text>
                  </View>
                ))}
                {setup.notes ? <Text style={s.notes}>{setup.notes}</Text> : null}
              </View>
            ))}
            {rider.notes ? <Text style={s.notes}>{rider.notes}</Text> : null}
          </View>
        ) : null}

        {/* Releases */}
        {mixes.length ? (
          <View style={s.section}>
            <SectionTitle title="Sets & Releases" />
            {mixes.map((m, i) => (
              <Link key={i} src={absUrl(m.url)} style={s.item} wrap={false}>
                <Text style={{ ...s.chip, backgroundColor: m.type === 'release' ? ORANGE : BLACK }}>
                  {m.type === 'release' ? 'REL' : 'SET'}
                </Text>
                <Text style={s.linkBold}>{m.title}</Text>
              </Link>
            ))}
          </View>
        ) : null}

        {/* Redes */}
        {socials.length ? (
          <View style={s.section}>
            <SectionTitle title="Redes" />
            {socials.map((so, i) => {
              const url = absUrl(socialToUrl(so.platform, so.url));
              return (
                <Link key={i} src={url} style={s.item} wrap={false}>
                  <Text style={{ ...s.chip, backgroundColor: BLACK }}>{so.platform}</Text>
                  <Text style={s.link}>{url}</Text>
                </Link>
              );
            })}
          </View>
        ) : null}

        {/* Links */}
        {links.length ? (
          <View style={s.section}>
            <SectionTitle title="Links" />
            {links.map((l, i) => (
              <Link key={i} src={absUrl(l.url)} style={s.item} wrap={false}>
                <Text style={{ ...s.chip, backgroundColor: ROSE }}>URL</Text>
                <Text style={s.linkBold}>{l.title}</Text>
              </Link>
            ))}
          </View>
        ) : null}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Drum and Bass Chile · Presskit</Text>
          <Link src="https://drumandbasschile.cl" style={{ ...s.footerText, color: BLUE }}>
            drumandbasschile.cl
          </Link>
        </View>
      </Page>
    </Document>
  );
}
