import React from 'react';
import { Document, Page, View, Text, Image, Link, StyleSheet } from '@react-pdf/renderer';
import type { Presskit } from '@/src/types/presskit';
import { socialToUrl } from '@/src/lib/socials';
import { parseRider, setupRows, riderIsEmpty } from '@/src/lib/rider';

// PDF "enviable" del presskit: documento propio (no captura de pantalla), con
// links clickeables. Estética brutalista (bordes negros, mayúsculas, acentos
// rosa/azul). Usa las fuentes base del PDF (Helvetica/Courier) para no depender
// de cargar fuentes externas.

const ROSE = '#ff0055';
const BLUE = '#0000ff';
const BLACK = '#000000';

const s = StyleSheet.create({
  page: { padding: 28, fontFamily: 'Helvetica', color: BLACK, fontSize: 10, lineHeight: 1.4 },
  // Header
  header: { flexDirection: 'row', border: `2pt solid ${BLACK}`, marginBottom: 14 },
  photo: { width: 150, height: 150, objectFit: 'cover', borderRight: `2pt solid ${BLACK}` },
  photoPlaceholder: { width: 150, height: 150, borderRight: `2pt solid ${BLACK}`, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  headerBody: { flex: 1, padding: 14, justifyContent: 'center' },
  name: { fontFamily: 'Helvetica-Bold', fontSize: 28, textTransform: 'uppercase', lineHeight: 1 },
  realName: { fontFamily: 'Courier', fontSize: 10, color: '#555', marginTop: 4, textTransform: 'uppercase' },
  meta: { fontFamily: 'Courier', fontSize: 9, color: '#555', marginTop: 6, textTransform: 'uppercase' },
  genres: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 4 },
  genre: { fontFamily: 'Helvetica-Bold', fontSize: 7, textTransform: 'uppercase', backgroundColor: BLACK, color: '#fff', paddingVertical: 2, paddingHorizontal: 5 },
  // Sections
  section: { marginBottom: 12 },
  h2: { fontFamily: 'Helvetica-Bold', fontSize: 13, textTransform: 'uppercase', borderBottom: `2pt solid ${BLACK}`, paddingBottom: 3, marginBottom: 6 },
  bio: { fontSize: 10, lineHeight: 1.5 },
  // Rider
  setup: { border: `1pt solid ${BLACK}`, padding: 8, marginBottom: 6 },
  setupName: { fontFamily: 'Helvetica-Bold', fontSize: 10, textTransform: 'uppercase', marginBottom: 3 },
  riderRow: { flexDirection: 'row', marginBottom: 2 },
  riderLabel: { fontFamily: 'Courier', fontSize: 8, color: '#555', textTransform: 'uppercase', width: 110 },
  riderValue: { fontFamily: 'Helvetica-Bold', fontSize: 10, flex: 1 },
  notes: { fontFamily: 'Courier', fontSize: 9, marginTop: 4 },
  // Lists (releases / socials / links)
  item: { flexDirection: 'row', marginBottom: 3, alignItems: 'flex-start' },
  bullet: { width: 12, fontFamily: 'Helvetica-Bold', color: ROSE },
  itemLink: { color: BLUE, textDecoration: 'underline', fontSize: 10, flex: 1 },
  itemTag: { fontFamily: 'Courier', fontSize: 7, color: '#555', textTransform: 'uppercase', marginRight: 4 },
  // Footer
  footer: { position: 'absolute', bottom: 18, left: 28, right: 28, borderTop: `2pt solid ${BLACK}`, paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontFamily: 'Courier', fontSize: 8, textTransform: 'uppercase', color: '#555' },
});

export function PresskitPdf({ presskit, photoData }: { presskit: Presskit; photoData?: string | null }) {
  const rider = parseRider(presskit.rider);
  const riderSetups = rider.setups.filter((x) => setupRows(x).length > 0 || x.notes);
  const mixes = (presskit.mixes || []).filter((m) => m.title?.trim() && m.url?.trim());
  const socials = (presskit.socials || []).filter((so) => so.url?.trim());
  const links = (presskit.links || []).filter((l) => l.title?.trim() && l.url?.trim());
  const metaLine = [presskit.city, presskit.country].filter(Boolean).join(', ');

  return (
    <Document title={`Presskit ${presskit.artist_name}`} author="Drum and Bass Chile">
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          {photoData ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={photoData} style={s.photo} />
          ) : (
            <View style={s.photoPlaceholder}>
              <Text style={{ color: ROSE, fontSize: 8, fontFamily: 'Courier' }}>DNB CHILE</Text>
            </View>
          )}
          <View style={s.headerBody}>
            <Text style={s.name}>{presskit.artist_name}</Text>
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

        {/* Bio */}
        {presskit.bio ? (
          <View style={s.section}>
            <Text style={s.h2}>Bio</Text>
            <Text style={s.bio}>{presskit.bio}</Text>
          </View>
        ) : null}

        {/* Rider técnico */}
        {!riderIsEmpty(rider) ? (
          <View style={s.section} wrap={false}>
            <Text style={s.h2}>Rider técnico</Text>
            {riderSetups.map((setup, i) => (
              <View key={i} style={s.setup}>
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

        {/* Releases / Sets */}
        {mixes.length ? (
          <View style={s.section}>
            <Text style={s.h2}>Sets & Releases</Text>
            {mixes.map((m, i) => (
              <View key={i} style={s.item}>
                <Text style={s.bullet}>▸</Text>
                <Text style={s.itemTag}>{m.type === 'release' ? 'REL' : 'SET'}</Text>
                <Link src={m.url} style={s.itemLink}>{m.title}</Link>
              </View>
            ))}
          </View>
        ) : null}

        {/* Redes */}
        {socials.length ? (
          <View style={s.section}>
            <Text style={s.h2}>Redes</Text>
            {socials.map((so, i) => {
              const url = socialToUrl(so.platform, so.url);
              return (
                <View key={i} style={s.item}>
                  <Text style={s.itemTag}>{so.platform}</Text>
                  <Link src={url} style={s.itemLink}>{url}</Link>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Links */}
        {links.length ? (
          <View style={s.section}>
            <Text style={s.h2}>Links</Text>
            {links.map((l, i) => (
              <View key={i} style={s.item}>
                <Text style={s.bullet}>▸</Text>
                <Link src={l.url} style={s.itemLink}>{l.title}</Link>
              </View>
            ))}
          </View>
        ) : null}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Drum and Bass Chile</Text>
          <Link src="https://drumandbasschile.cl" style={{ ...s.footerText, color: BLUE, textDecoration: 'underline' }}>
            drumandbasschile.cl
          </Link>
        </View>
      </Page>
    </Document>
  );
}
