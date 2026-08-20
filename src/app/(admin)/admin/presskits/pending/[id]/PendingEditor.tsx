'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/src/lib/supabase';
import { useAdminAuth } from '@/src/components/admin/AdminAuthContext';
import { socialToHandle, socialToUrl } from '@/src/lib/socials';
import {
  RiderData,
  RiderSetup,
  PLAYER_MODELS,
  MIXER_MODELS,
  CONTROLLER_MODELS,
  parseRider,
  serializeRider,
  emptySetup,
} from '@/src/lib/rider';
import { emptyPendingData, PendingPresskitData } from '@/src/types/pendingPresskit';
import type { PresskitSocial, PresskitMix, PresskitLink, PresskitCustomSection } from '@/src/types/presskit';
import { RiLoader4Line, RiDeleteBinLine, RiMailSendLine, RiSaveLine, RiExternalLinkLine, RiImageAddLine, RiPlayFill, RiPauseFill } from '@remixicon/react';

// Base SIN ancho: en filas flex el ancho lo da flex-1/w-N. `inputClass` (con
// w-full) es solo para campos de una columna; en filas flex usar `fieldBase` +
// el ancho explícito, si no `w-full` pisa a `w-40`/`w-28` y descuadra la fila.
const fieldBase =
  'brutalist-border px-3 py-2 mono text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#ff0055]';
const inputClass = `${fieldBase} w-full`;
const labelClass = 'mono text-xs font-black uppercase mb-1 block';

async function compress(file: File, maxWidth = 2000, quality = 0.85): Promise<Blob> {
  const img = document.createElement('img');
  const url = URL.createObjectURL(file);
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = url;
  });
  const scale = Math.min(1, maxWidth / img.width);
  const canvas = document.createElement('canvas');
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  return new Promise((res) => canvas.toBlob((b) => res(b || file), 'image/webp', quality));
}

const SOCIAL_PLATFORMS = ['Instagram', 'SoundCloud', 'Spotify', 'YouTube', 'TikTok', 'Facebook', 'Twitter', 'Bandcamp'];
const MIX_TYPE_OPTIONS = [
  { value: 'set', label: 'Set' },
  { value: 'release', label: 'Release' },
] as const;

interface SoundcloudTrackOption {
  id: string;
  title: string;
  url: string;
  isAlbum?: boolean; // Bandcamp: álbum/EP vs track suelto
}
const isSetUrl = (url: string) => /soundcloud\.com\/[^/]+\/sets\//i.test(url);
const fmtTime = (s: number) => {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${String(ss).padStart(2, '0')}`;
};

export default function PendingEditor({ mode = 'pending' }: { mode?: 'pending' | 'presskit' }) {
  const { isAdmin, loading: authLoading } = useAdminAuth();
  const router = useRouter();
  const routeParams = useParams<{ id: string }>();
  // mode 'pending' → edita pending_presskits (crear + invitar). mode 'presskit'
  // → edita un presskit YA publicado (mismo editor, guarda vía /api/admin/presskits).
  const isPresskit = mode === 'presskit';
  const isNew = !isPresskit && routeParams.id === 'new';
  const supabase = createClient();

  const [id, setId] = useState<string | null>(isNew ? null : routeParams.id);
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('pending');
  const [invitedAt, setInvitedAt] = useState<string | null>(null);
  const [published, setPublished] = useState(true);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [msg, setMsg] = useState('');

  // Campos
  const [email, setEmail] = useState('');
  const [slug, setSlug] = useState('');
  const [artistName, setArtistName] = useState('');
  const [realName, setRealName] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [genresInput, setGenresInput] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [logoUrls, setLogoUrls] = useState<string[]>([]);
  const [socials, setSocials] = useState<PresskitSocial[]>([]);
  const [mixes, setMixes] = useState<PresskitMix[]>([]);
  const [links, setLinks] = useState<PresskitLink[]>([]);
  const [customSections, setCustomSections] = useState<PresskitCustomSection[]>([]);
  const [riderData, setRiderData] = useState<RiderData>({ setups: [] });
  const [uploading, setUploading] = useState(false);
  const scRef = useRef<HTMLInputElement | null>(null);
  const bcRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  // Fuente del import abierto en el dropdown (define plataforma al agregar).
  const [importSource, setImportSource] = useState<'soundcloud' | 'bandcamp'>('soundcloud');
  // Preview del track seleccionado (escuchar sin salir de la página).
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);
  // Importar desde SoundCloud: mismo flujo que el editor del DJ — dropdown de
  // tracks, se agrega de a uno y por cada uno se elige release/set (y EP vs playlist).
  const [scTracks, setScTracks] = useState<SoundcloudTrackOption[]>([]);
  const [scLoading, setScLoading] = useState(false);
  const [scError, setScError] = useState('');
  const [scSelectedTrack, setScSelectedTrack] = useState('');
  const [scSelectedType, setScSelectedType] = useState<'set' | 'release'>('set');
  const [scDropdownOpen, setScDropdownOpen] = useState(false);
  const [epPrompt, setEpPrompt] = useState<SoundcloudTrackOption | null>(null);
  const [playlistBlocked, setPlaylistBlocked] = useState(false);

  const applyData = useCallback((d: Partial<PendingPresskitData>) => {
    setArtistName(d.artist_name || '');
    setRealName(d.real_name || '');
    setCity(d.city || '');
    setCountry(d.country || '');
    setGenresInput((d.genres || []).join(', '));
    setBio(d.bio || '');
    setPhotoUrls(d.photo_urls || []);
    setLogoUrls(d.logo_urls || []);
    setSocials((d.socials || []).map((s) => ({ platform: s.platform, url: socialToHandle(s.platform, s.url) })));
    setMixes(d.mixes || []);
    setLinks(d.links || []);
    setCustomSections(d.custom_sections || []);
    setRiderData(parseRider(d.rider ?? null));
  }, []);

  const load = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    if (isPresskit) {
      // Presskit publicado: la lista admin trae todos con select('*').
      const res = await fetch('/api/admin/presskits');
      const { presskits } = await res.json();
      const pk = (presskits || []).find((p: { id: string }) => p.id === routeParams.id);
      if (pk) {
        setId(pk.id);
        setEmail(pk.email || '');
        setSlug(pk.slug || '');
        setPublished(pk.published ?? true);
        applyData(pk as Partial<PendingPresskitData>);
      }
    } else {
      const res = await fetch(`/api/admin/pending-presskits?id=${routeParams.id}`);
      const { pending } = await res.json();
      if (pending) {
        setId(pending.id);
        setClaimToken(pending.claim_token);
        setStatus(pending.status);
        setInvitedAt(pending.invited_at);
        setEmail(pending.email || '');
        setSlug(pending.slug || '');
        applyData(pending.data || emptyPendingData());
      }
    }
    setLoading(false);
  }, [isNew, isPresskit, routeParams.id, applyData]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const buildData = (): PendingPresskitData => ({
    artist_name: artistName.trim(),
    real_name: realName.trim() || null,
    city: city.trim() || null,
    country: country.trim() || null,
    genres: genresInput.split(',').map((g) => g.trim()).filter(Boolean),
    bio: bio.trim() || null,
    custom_sections: customSections.map((s) => ({ title: s.title.trim(), body: s.body.trim() })).filter((s) => s.title && s.body),
    rider: serializeRider(riderData),
    photo_urls: photoUrls,
    logo_urls: logoUrls,
    socials: socials
      .filter((s) => s.url.trim())
      .map((s) => ({ platform: s.platform, url: socialToUrl(s.platform, s.url.trim()) })),
    mixes: mixes.filter((m) => m.title.trim() && m.url.trim()),
    links: links.filter((l) => l.title.trim() && l.url.trim()),
  });

  const save = async (): Promise<string | null> => {
    if (!artistName.trim() || (!isPresskit && (!email.trim() || !slug.trim()))) {
      setMsg(isPresskit ? 'Falta el nombre artístico' : 'Faltan email, slug o nombre artístico');
      return null;
    }
    setSaving(true);
    setMsg('');
    try {
      if (isPresskit) {
        // Editar presskit publicado → PATCH /api/admin/presskits con todos los campos.
        const res = await fetch('/api/admin/presskits', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...buildData(), published }),
        });
        const data = await res.json();
        if (!res.ok) {
          setMsg(`Error: ${data.error}`);
          return null;
        }
        setMsg('Guardado');
        setTimeout(() => setMsg(''), 2500);
        return id;
      }
      const body = { id, email: email.trim(), slug: slug.trim(), data: buildData() };
      const res = await fetch('/api/admin/pending-presskits', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(`Error: ${data.error}`);
        return null;
      }
      setId(data.pending.id);
      setClaimToken(data.pending.claim_token);
      setStatus(data.pending.status);
      setMsg('Guardado');
      setTimeout(() => setMsg(''), 2500);
      if (isNew) router.replace(`/admin/presskits/pending/${data.pending.id}`);
      return data.pending.id;
    } finally {
      setSaving(false);
    }
  };

  const sendInvite = async () => {
    const savedId = id || (await save());
    if (!savedId) return;
    setInviting(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/pending-presskits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invite', id: savedId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(`Error: ${data.error}`);
        return;
      }
      setInvitedAt(new Date().toISOString());
      setMsg('Invitación enviada ✓');
      setTimeout(() => setMsg(''), 3000);
    } finally {
      setInviting(false);
    }
  };

  const uploadPhotos = async (files: File[], kind: 'photo' | 'logo') => {
    if (!files.length) return;
    setUploading(true);
    setMsg('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setMsg('Sesión no encontrada. Recarga la página.');
      setUploading(false);
      return;
    }
    const out: string[] = [];
    for (const file of files) {
      const blob = file.size > 4 * 1024 * 1024 && kind === 'photo' ? await compress(file) : file;
      const ext = blob === file ? file.name.split('.').pop() || 'jpg' : 'webp';
      const path = `${user.id}/${kind}-${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
      const { error } = await supabase.storage.from('pk-photos').upload(path, blob, { upsert: true });
      if (error) {
        setMsg(`Error subiendo: ${error.message}`);
        continue;
      }
      out.push(supabase.storage.from('pk-photos').getPublicUrl(path).data.publicUrl);
    }
    if (kind === 'photo') setPhotoUrls((p) => [...p, ...out]);
    else setLogoUrls((p) => [...p, ...out].slice(0, 3));
    if (out.length) {
      setMsg(`${out.length} ${kind === 'photo' ? 'foto(s)' : 'logo(s)'} subida(s)`);
      setTimeout(() => setMsg(''), 2500);
    }
    setUploading(false);
  };

  const fetchScTracks = async () => {
    // URL manual → esa cuenta puntual. Si no, TODAS las cuentas de SoundCloud
    // del DJ (puede tener más de una) y se mergean.
    const manual = scRef.current?.value.trim();
    const urls = manual
      ? [manual]
      : socials.filter((s) => s.platform === 'SoundCloud' && s.url.trim()).map((s) => socialToUrl('SoundCloud', s.url));
    if (urls.length === 0) {
      setMsg('Agrega el SoundCloud del DJ (en Redes) o pega la URL del perfil');
      return;
    }
    setImportSource('soundcloud');
    setScLoading(true);
    setScError('');
    setScTracks([]);
    setScSelectedTrack('');
    setEpPrompt(null);
    setPlaylistBlocked(false);
    setScDropdownOpen(true);
    try {
      const perAccount = await Promise.all(
        urls.map(async (u) => {
          try {
            const res = await fetch(`/api/pk/soundcloud?url=${encodeURIComponent(u)}`);
            if (!res.ok) return [] as SoundcloudTrackOption[];
            const data = await res.json();
            return (data.tracks || []) as SoundcloudTrackOption[];
          } catch {
            return [] as SoundcloudTrackOption[];
          }
        })
      );
      const existing = new Set(mixes.map((m) => m.url));
      const seen = new Set<string>();
      const available: SoundcloudTrackOption[] = [];
      for (const t of perAccount.flat()) {
        if (existing.has(t.url) || seen.has(t.url)) continue;
        seen.add(t.url);
        available.push(t);
      }
      available.sort((a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base', numeric: true }));
      setScTracks(available);
      if (available.length > 0) setScSelectedTrack(String(available[0].id));
      else setScError('No se encontraron tracks.');
    } catch {
      setScError('Error al conectar con SoundCloud');
    } finally {
      setScLoading(false);
    }
  };

  // Agrega UN track a la lista de mixes. Bandcamp → siempre release (álbum = EP).
  // SoundCloud → release/set según elección (EP → release + is_ep).
  const addMixEntry = (track: SoundcloudTrackOption, isEp: boolean) => {
    const bandcamp = importSource === 'bandcamp';
    setMixes((m) => [
      ...m,
      {
        title: track.title,
        platform: bandcamp ? 'Bandcamp' : 'SoundCloud',
        url: track.url,
        type: bandcamp ? 'release' : isEp ? 'release' : scSelectedType,
        ...(isEp ? { is_ep: true } : {}),
      },
    ]);
    // Sacamos el agregado del dropdown para poder seguir agregando el resto.
    setScTracks((arr) => {
      const rest = arr.filter((t) => t.url !== track.url);
      setScSelectedTrack(rest[0] ? String(rest[0].id) : '');
      return rest;
    });
    setEpPrompt(null);
    setPlaylistBlocked(false);
  };

  const addScTrack = () => {
    const track = scTracks.find((t) => String(t.id) === scSelectedTrack);
    if (!track) return;
    if (importSource === 'bandcamp') {
      // En Bandcamp un álbum es un EP; un track es un release suelto. Sin ambigüedad.
      addMixEntry(track, !!track.isAlbum);
      return;
    }
    if (isSetUrl(track.url)) {
      setEpPrompt(track); // preguntar EP vs playlist
      return;
    }
    addMixEntry(track, false);
  };

  // Escuchar el track seleccionado sin salir de la página (SoundCloud o Bandcamp).
  const togglePreview = async () => {
    const sel = scTracks.find((t) => String(t.id) === scSelectedTrack);
    const a = previewAudioRef.current;
    if (!sel || !a) return;
    if (previewUrl === sel.url) {
      if (a.paused) a.play().catch(() => {});
      else a.pause();
      return;
    }
    setPreviewLoading(true);
    try {
      const endpoint = /bandcamp\.com/i.test(sel.url) ? '/api/pk/bandcamp/stream' : '/api/pk/soundcloud/stream';
      const res = await fetch(`${endpoint}?url=${encodeURIComponent(sel.url)}`);
      const data = await res.json();
      if (!res.ok || !data.streamUrl) {
        setMsg('No se pudo reproducir este track');
        return;
      }
      a.src = data.streamUrl;
      setPreviewUrl(sel.url);
      setPreviewTime(0);
      setPreviewDuration(0);
      a.play().catch(() => {});
    } catch {
      setMsg('Error al reproducir');
    } finally {
      setPreviewLoading(false);
    }
  };

  const fetchBcTracks = async () => {
    const manual = bcRef.current?.value.trim();
    const social = socials.find((s) => s.platform === 'Bandcamp' && s.url.trim())?.url;
    const url = manual || (social ? socialToUrl('Bandcamp', social) : '');
    if (!url) {
      setMsg('Pega la URL del Bandcamp del artista (ej. https://artista.bandcamp.com)');
      return;
    }
    setImportSource('bandcamp');
    setScLoading(true);
    setScError('');
    setScTracks([]);
    setScSelectedTrack('');
    setEpPrompt(null);
    setPlaylistBlocked(false);
    setScDropdownOpen(true);
    try {
      const res = await fetch(`/api/pk/bandcamp?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (!res.ok) {
        setScError(data.error || 'Error al cargar la discografía');
        return;
      }
      const existing = new Set(mixes.map((m) => m.url));
      const available: SoundcloudTrackOption[] = (data.tracks || []).filter(
        (t: SoundcloudTrackOption) => !existing.has(t.url)
      );
      setScTracks(available);
      if (available.length > 0) setScSelectedTrack(String(available[0].id));
      else setScError('No se encontraron releases en ese Bandcamp.');
    } catch {
      setScError('Error al conectar con Bandcamp');
    } finally {
      setScLoading(false);
    }
  };

  if (authLoading || loading) {
    return <div className="p-12 flex justify-center"><RiLoader4Line className="w-8 h-8 animate-spin" /></div>;
  }
  if (!isAdmin) {
    return <div className="p-12 text-center mono uppercase font-black">Sin acceso</div>;
  }

  const claimUrl = claimToken ? `/pk/claim?token=${claimToken}` : null;

  return (
    <main className="max-w-3xl mx-auto p-6 lg:p-10 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <button onClick={() => router.push('/admin/presskits')} className="mono text-xs font-bold uppercase text-gray-500 hover:text-black">← Volver</button>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter">{isPresskit ? 'Editar presskit' : isNew ? 'Nuevo PK para un DJ' : 'Editar PK pendiente'}</h1>
        </div>
        {!isPresskit && status !== 'pending' && (
          <span className="mono text-xs font-black uppercase bg-[#00b341] text-white px-2 py-1">{status === 'claimed' ? 'Reclamado' : status}</span>
        )}
      </div>

      {/* Identidad */}
      {isPresskit ? (
        <section className="brutalist-border p-4 flex flex-wrap items-center justify-between gap-3 bg-gray-50">
          <div className="mono text-xs text-gray-600">
            <span className="font-black uppercase">{email || 'sin email'}</span> · /artistas/{slug}
          </div>
          <label className="mono text-xs font-black uppercase flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
            {published ? 'Publicado' : 'Borrador (no público)'}
          </label>
        </section>
      ) : (
        <section className="brutalist-border p-4 space-y-3 bg-yellow-50">
          <div>
            <label className={labelClass}>Email del DJ *</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="dj@correo.com" className={inputClass} type="email" />
            <p className="mono text-[11px] text-gray-500 mt-1">A este correo le llega la invitación. Debe ser el mismo con el que el DJ inicia sesión en Google.</p>
          </div>
          <div>
            <label className={labelClass}>Slug (URL: /artistas/&lt;slug&gt;) *</label>
            <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="dj-nombre" className={inputClass} />
          </div>
        </section>
      )}

      {/* Datos básicos */}
      <section className="space-y-3">
        <Field label="Nombre artístico *" value={artistName} onChange={setArtistName} />
        <Field label="Nombre real" value={realName} onChange={setRealName} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ciudad" value={city} onChange={setCity} />
          <Field label="País" value={country} onChange={setCountry} />
        </div>
        <Field label="Géneros (separados por coma)" value={genresInput} onChange={setGenresInput} placeholder="Drum and Bass, Neurofunk" />
        <div>
          <label className={labelClass}>Bio</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} className={`${inputClass} min-h-[120px] resize-y`} rows={5} />
        </div>
      </section>

      {/* Fotos */}
      <section className="brutalist-border p-4 space-y-3">
        <label className={labelClass}>Fotos</label>
        <div className="flex flex-wrap gap-2">
          {photoUrls.map((u, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="w-20 h-20 object-cover brutalist-border" />
              <button onClick={() => setPhotoUrls((p) => p.filter((_, idx) => idx !== i))} className="absolute -top-2 -right-2 bg-red-600 text-white w-5 h-5 text-xs">×</button>
            </div>
          ))}
        </div>
        <input ref={photoInputRef} type="file" accept="image/*" multiple onChange={(e) => { const fs = Array.from(e.target.files || []); e.target.value = ''; void uploadPhotos(fs, 'photo'); }} className="hidden" />
        <button type="button" onClick={() => photoInputRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-2 mono text-xs font-black uppercase px-4 py-2 brutalist-border bg-black text-white hover:bg-gray-900 disabled:opacity-50">
          <RiImageAddLine className="w-4 h-4" /> Subir fotos
        </button>
      </section>

      {/* Logos */}
      <section className="brutalist-border p-4 space-y-3">
        <label className={labelClass}>Logos (máx 3)</label>
        <div className="flex flex-wrap gap-2">
          {logoUrls.map((u, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="w-20 h-20 object-contain brutalist-border bg-gray-100" />
              <button onClick={() => setLogoUrls((p) => p.filter((_, idx) => idx !== i))} className="absolute -top-2 -right-2 bg-red-600 text-white w-5 h-5 text-xs">×</button>
            </div>
          ))}
        </div>
        <input ref={logoInputRef} type="file" accept="image/*" multiple onChange={(e) => { const fs = Array.from(e.target.files || []); e.target.value = ''; void uploadPhotos(fs, 'logo'); }} className="hidden" />
        {logoUrls.length < 3 && (
          <button type="button" onClick={() => logoInputRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-2 mono text-xs font-black uppercase px-4 py-2 brutalist-border bg-black text-white hover:bg-gray-900 disabled:opacity-50">
            <RiImageAddLine className="w-4 h-4" /> Subir logos
          </button>
        )}
      </section>
      {uploading && <p className="mono text-xs uppercase text-[#ff0055]">Subiendo…</p>}

      {/* Redes */}
      <ListSection
        title="Redes"
        items={socials}
        onAdd={() => setSocials((s) => [...s, { platform: 'Instagram', url: '' }])}
        onRemove={(i) => setSocials((s) => s.filter((_, idx) => idx !== i))}
        render={(s, i) => (
          <div className="flex gap-2">
            <select value={s.platform} onChange={(e) => setSocials((arr) => arr.map((x, idx) => (idx === i ? { ...x, platform: e.target.value } : x)))} className={`${fieldBase} w-36 shrink-0`}>
              {SOCIAL_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input value={s.url} onChange={(e) => setSocials((arr) => arr.map((x, idx) => (idx === i ? { ...x, url: e.target.value } : x)))} placeholder="usuario o URL" className={`${fieldBase} flex-1 min-w-0`} />
          </div>
        )}
      />

      {/* Mixes / releases */}
      <section className="brutalist-border p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label className={labelClass}>Sets & Releases</label>
          <button onClick={() => setMixes((m) => [...m, { title: '', platform: 'SoundCloud', url: '', type: 'set' }])} className="mono text-xs font-bold uppercase px-3 py-1.5 brutalist-border bg-black text-white">+ Track</button>
        </div>
        <div className="flex gap-2 items-center">
          <input ref={scRef} placeholder="URL perfil SoundCloud (opcional si está en Redes)" className={`${fieldBase} flex-1 min-w-0`} />
          <button onClick={fetchScTracks} disabled={scLoading} className="mono text-xs font-bold uppercase px-3 py-2 brutalist-border bg-[#ff5500] text-white disabled:opacity-50 whitespace-nowrap">
            {scLoading ? '…' : 'Traer de SoundCloud'}
          </button>
        </div>
        <div className="flex gap-2 items-center">
          <input ref={bcRef} placeholder="URL Bandcamp del artista (ej. https://artista.bandcamp.com)" className={`${fieldBase} flex-1 min-w-0`} />
          <button onClick={fetchBcTracks} disabled={scLoading} className="mono text-xs font-bold uppercase px-3 py-2 brutalist-border bg-[#1da0c3] text-white disabled:opacity-50 whitespace-nowrap">
            {scLoading ? '…' : 'Traer de Bandcamp'}
          </button>
        </div>

        {/* Dropdown de importación: agregar de a uno, eligiendo release/set por cada uno */}
        {scDropdownOpen && (
          <div className="brutalist-border p-4 space-y-3 bg-gray-50">
            {scLoading && (
              <div className="flex items-center gap-2 mono text-xs">
                <RiLoader4Line className="w-4 h-4 animate-spin" /> Cargando de {importSource === 'bandcamp' ? 'Bandcamp' : 'SoundCloud'}…
              </div>
            )}
            {scError && <p className="mono text-xs text-red-500">{scError}</p>}
            {!scLoading && scTracks.length > 0 && (
              <>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select value={scSelectedTrack} onChange={(e) => setScSelectedTrack(e.target.value)} className={`${fieldBase} flex-1 min-w-0`}>
                    {scTracks.map((t) => <option key={t.id} value={String(t.id)}>{importSource === 'bandcamp' && t.isAlbum ? `[EP] ${t.title}` : t.title}</option>)}
                  </select>
                  {/* En Bandcamp el tipo es siempre release (álbum = EP); no se elige. */}
                  {importSource !== 'bandcamp' && (
                    <select value={scSelectedType} onChange={(e) => setScSelectedType(e.target.value as 'set' | 'release')} className={`${fieldBase} sm:w-32 shrink-0`}>
                      {MIX_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                  <button onClick={addScTrack} className="mono text-xs font-bold uppercase px-3 py-1.5 brutalist-border bg-[#ff5500] text-white hover:bg-[#cc4400]">+ Agregar</button>
                  {(() => {
                    const sel = scTracks.find((t) => String(t.id) === scSelectedTrack);
                    if (!sel) return null;
                    const isCur = previewUrl === sel.url;
                    return (
                      <>
                        <button onClick={togglePreview} disabled={previewLoading} className="mono text-xs font-bold uppercase px-3 py-1.5 brutalist-border inline-flex items-center gap-1 hover:bg-black hover:text-white disabled:opacity-50">
                          {previewLoading && !isCur ? <RiLoader4Line className="w-3.5 h-3.5 animate-spin" /> : isCur && previewPlaying ? <RiPauseFill className="w-3.5 h-3.5" /> : <RiPlayFill className="w-3.5 h-3.5" />}
                          {isCur && previewPlaying ? 'Pausar' : 'Escuchar'}
                        </button>
                        <a href={sel.url} target="_blank" rel="noopener noreferrer" className="mono text-xs font-bold uppercase px-3 py-1.5 brutalist-border inline-flex items-center gap-1 text-blue-700 hover:bg-blue-50">
                          Ver track <RiExternalLinkLine className="w-3.5 h-3.5" />
                        </a>
                      </>
                    );
                  })()}
                  <button onClick={() => { previewAudioRef.current?.pause(); setScDropdownOpen(false); setScTracks([]); setScError(''); setEpPrompt(null); setPlaylistBlocked(false); }} className="mono text-xs font-bold uppercase px-3 py-1.5 brutalist-border hover:bg-black hover:text-white">Cerrar</button>
                  <span className="mono text-[11px] uppercase text-gray-500 self-center">{scTracks.length} por agregar</span>
                </div>
                <audio
                  ref={previewAudioRef}
                  preload="none"
                  onPlay={() => setPreviewPlaying(true)}
                  onPause={() => setPreviewPlaying(false)}
                  onEnded={() => setPreviewPlaying(false)}
                  onTimeUpdate={() => setPreviewTime(previewAudioRef.current?.currentTime || 0)}
                  onLoadedMetadata={() => setPreviewDuration(previewAudioRef.current?.duration || 0)}
                />
                {previewUrl && (
                  <div className="space-y-1">
                    <p className="mono text-[11px] uppercase text-gray-500 truncate">
                      {previewLoading ? 'Cargando audio…' : `${previewPlaying ? '▶' : '❚❚'} ${scTracks.find((t) => t.url === previewUrl)?.title || ''}`}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="mono text-[10px] tabular-nums text-gray-500 w-9 text-right">{fmtTime(previewTime)}</span>
                      <input
                        type="range"
                        min={0}
                        max={previewDuration || 0}
                        step={0.1}
                        value={Math.min(previewTime, previewDuration || 0)}
                        onChange={(e) => {
                          const a = previewAudioRef.current;
                          if (a) { a.currentTime = +e.target.value; setPreviewTime(+e.target.value); }
                        }}
                        aria-label="Avanzar en el track"
                        className="flex-1 h-1.5 accent-[#ff0055] cursor-pointer"
                      />
                      <span className="mono text-[10px] tabular-nums text-gray-500 w-9">{fmtTime(previewDuration)}</span>
                    </div>
                  </div>
                )}

                {/* Set → preguntar si es EP (publicable) o playlist (no) */}
                {epPrompt && (
                  <div className="brutalist-border bg-yellow-50 p-3 space-y-2">
                    <p className="mono text-xs font-bold uppercase">«{epPrompt.title}» es un set de SoundCloud. ¿Qué es?</p>
                    <p className="mono text-[11px] opacity-70 normal-case">Un EP se publica en Releases Nacionales. Una playlist (recopilatorio) no se puede publicar.</p>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => addMixEntry(epPrompt, true)} className="mono text-xs font-bold uppercase px-3 py-1.5 brutalist-border bg-[#7C3AED] text-white hover:opacity-90">Es un EP</button>
                      <button onClick={() => { setEpPrompt(null); setPlaylistBlocked(true); }} className="mono text-xs font-bold uppercase px-3 py-1.5 brutalist-border hover:bg-black hover:text-white">Es una playlist</button>
                    </div>
                  </div>
                )}
                {playlistBlocked && !epPrompt && (
                  <p className="mono text-xs text-red-500 normal-case">Las playlists no se publican en Releases Nacionales. Elige un track o un EP.</p>
                )}
              </>
            )}
            {!scLoading && scTracks.length === 0 && !scError && <p className="mono text-xs opacity-40">No quedan tracks por agregar.</p>}
          </div>
        )}
        {mixes.map((m, i) => (
          <div key={i} className="border-2 border-black p-2 space-y-2 bg-gray-50">
            <div className="flex gap-2">
              <input value={m.title} onChange={(e) => setMixes((arr) => arr.map((x, idx) => (idx === i ? { ...x, title: e.target.value } : x)))} placeholder="Título" className={`${fieldBase} flex-1 min-w-0`} />
              <select value={m.type || 'set'} onChange={(e) => setMixes((arr) => arr.map((x, idx) => (idx === i ? { ...x, type: e.target.value as 'set' | 'release' } : x)))} className={`${fieldBase} w-28 shrink-0`}>
                <option value="set">Set</option>
                <option value="release">Release</option>
              </select>
              <button onClick={() => setMixes((arr) => arr.filter((_, idx) => idx !== i))} className="px-2 brutalist-border border-red-600 text-red-600"><RiDeleteBinLine className="w-4 h-4" /></button>
            </div>
            <input value={m.url} onChange={(e) => setMixes((arr) => arr.map((x, idx) => (idx === i ? { ...x, url: e.target.value, released_at: null } : x)))} placeholder="URL de SoundCloud" className={inputClass} />
            <label className="mono text-[11px] font-bold uppercase flex items-center gap-2">
              <input type="checkbox" checked={!!m.featured} onChange={(e) => setMixes((arr) => arr.map((x, idx) => (idx === i ? { ...x, featured: e.target.checked } : x)))} />
              Publicar en Releases Nacionales
            </label>
          </div>
        ))}
      </section>

      {/* Links */}
      <ListSection
        title="Links"
        items={links}
        onAdd={() => setLinks((l) => [...l, { title: '', url: '' }])}
        onRemove={(i) => setLinks((l) => l.filter((_, idx) => idx !== i))}
        render={(l, i) => (
          <div className="flex gap-2">
            <input value={l.title} onChange={(e) => setLinks((arr) => arr.map((x, idx) => (idx === i ? { ...x, title: e.target.value } : x)))} placeholder="Título" className={`${fieldBase} w-40 shrink-0`} />
            <input value={l.url} onChange={(e) => setLinks((arr) => arr.map((x, idx) => (idx === i ? { ...x, url: e.target.value } : x)))} placeholder="URL" className={`${fieldBase} flex-1 min-w-0`} />
          </div>
        )}
      />

      {/* Secciones personalizadas */}
      <ListSection
        title="Secciones personalizadas"
        items={customSections}
        onAdd={() => setCustomSections((c) => [...c, { title: '', body: '' }])}
        onRemove={(i) => setCustomSections((c) => c.filter((_, idx) => idx !== i))}
        render={(s, i) => (
          <div className="space-y-2">
            <input value={s.title} onChange={(e) => setCustomSections((arr) => arr.map((x, idx) => (idx === i ? { ...x, title: e.target.value } : x)))} placeholder="Título" className={`${inputClass} font-bold uppercase`} />
            <textarea value={s.body} onChange={(e) => setCustomSections((arr) => arr.map((x, idx) => (idx === i ? { ...x, body: e.target.value } : x)))} placeholder="Contenido" className={`${inputClass} min-h-[80px]`} />
          </div>
        )}
      />

      {/* Rider */}
      <section className="brutalist-border p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label className={labelClass}>Rider técnico</label>
          <button onClick={() => setRiderData((d) => ({ ...d, setups: [...d.setups, emptySetup()] }))} className="mono text-xs font-bold uppercase px-3 py-1.5 brutalist-border bg-black text-white">+ Setup</button>
        </div>
        {riderData.setups.map((s, si) => {
          const upd = (patch: Partial<RiderSetup>) => setRiderData((d) => ({ ...d, setups: d.setups.map((x, i) => (i === si ? { ...x, ...patch } : x)) }));
          const isCtrl = !!s.controller;
          return (
            <div key={si} className="border-2 border-black p-3 space-y-2 bg-gray-50">
              <div className="flex gap-2 items-center">
                {isCtrl ? <span className="flex-1 mono text-xs font-black uppercase text-[#7C3AED]">Controlador</span> : (
                  <input value={s.name || ''} onChange={(e) => upd({ name: e.target.value })} placeholder={`Setup ${si + 1} (nombre opcional)`} className={`${fieldBase} flex-1 min-w-0`} />
                )}
                <button onClick={() => setRiderData((d) => ({ ...d, setups: d.setups.filter((_, i) => i !== si) }))} className="px-2 brutalist-border border-red-600 text-red-600"><RiDeleteBinLine className="w-4 h-4" /></button>
              </div>
              <div className="inline-flex brutalist-border">
                <button onClick={() => upd({ players: { model: '', quantity: 2 }, mixer: undefined, controller: undefined })} className={`mono text-[10px] font-black uppercase px-2 py-1.5 ${!isCtrl ? 'bg-[#7C3AED] text-white' : 'bg-white'}`}>Reproductores + Mixer</button>
                <button onClick={() => upd({ controller: { model: '' }, players: undefined, mixer: undefined, name: undefined })} className={`mono text-[10px] font-black uppercase px-2 py-1.5 border-l-2 border-black ${isCtrl ? 'bg-[#7C3AED] text-white' : 'bg-white'}`}>Controlador</button>
              </div>
              {isCtrl ? (
                <select value={s.controller?.model || ''} onChange={(e) => upd({ controller: { model: e.target.value } })} className={inputClass}>
                  <option value="">— Modelo del controlador —</option>
                  {CONTROLLER_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <select value={s.players?.model || ''} onChange={(e) => upd({ players: { model: e.target.value, quantity: s.players?.quantity || 2 } })} className={`${fieldBase} flex-1 min-w-0`}>
                      <option value="">— Reproductores —</option>
                      {PLAYER_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <input type="number" min={1} max={8} value={s.players?.quantity || 2} onChange={(e) => upd({ players: { model: s.players?.model || '', quantity: Math.max(1, +e.target.value || 1) } })} className={`${fieldBase} w-20 shrink-0`} />
                  </div>
                  <select value={s.mixer || ''} onChange={(e) => upd({ mixer: e.target.value || undefined })} className={inputClass}>
                    <option value="">— Mixer —</option>
                    {MIXER_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Barra de acciones */}
      <div className="sticky bottom-0 bg-white border-t-4 border-black py-3 flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 brutalist-border bg-black text-white px-5 py-2.5 mono text-sm font-black uppercase hover:bg-gray-900 disabled:opacity-50">
          {saving ? <RiLoader4Line className="w-4 h-4 animate-spin" /> : <RiSaveLine className="w-4 h-4" />} Guardar
        </button>
        {!isPresskit && (
          <button onClick={sendInvite} disabled={inviting || status !== 'pending'} className="inline-flex items-center gap-2 brutalist-border bg-[#ff0055] text-white px-5 py-2.5 mono text-sm font-black uppercase hover:bg-black disabled:opacity-50">
            {inviting ? <RiLoader4Line className="w-4 h-4 animate-spin" /> : <RiMailSendLine className="w-4 h-4" />} {invitedAt ? 'Reenviar invitación' : 'Enviar invitación'}
          </button>
        )}
        {isPresskit && slug && (
          <a href={`/artistas/${slug}`} target="_blank" rel="noopener noreferrer" className="mono text-xs font-bold uppercase text-blue-700 inline-flex items-center gap-1">
            Ver PK <RiExternalLinkLine className="w-3 h-3" />
          </a>
        )}
        {!isPresskit && claimUrl && (
          <a href={claimUrl} target="_blank" rel="noopener noreferrer" className="mono text-xs font-bold uppercase text-blue-700 inline-flex items-center gap-1">
            Ver link de claim <RiExternalLinkLine className="w-3 h-3" />
          </a>
        )}
        {msg && <span className="mono text-xs font-bold uppercase text-[#ff0055]">{msg}</span>}
        {!isPresskit && invitedAt && <span className="mono text-[11px] uppercase text-gray-500">Invitado</span>}
      </div>
    </main>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputClass} />
    </div>
  );
}

function ListSection<T>({ title, items, onAdd, onRemove, render }: { title: string; items: T[]; onAdd: () => void; onRemove: (i: number) => void; render: (item: T, i: number) => React.ReactNode }) {
  return (
    <section className="brutalist-border p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label className={labelClass}>{title}</label>
        <button onClick={onAdd} className="mono text-xs font-bold uppercase px-3 py-1.5 brutalist-border bg-black text-white">+ Agregar</button>
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-start">
          <div className="flex-1">{render(item, i)}</div>
          <button onClick={() => onRemove(i)} className="px-2 py-2 brutalist-border border-red-600 text-red-600 shrink-0"><RiDeleteBinLine className="w-4 h-4" /></button>
        </div>
      ))}
    </section>
  );
}
