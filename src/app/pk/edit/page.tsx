'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PkAuthProvider, usePkAuth } from '@/src/components/pk/PkAuthContext';
import { PkAuthModal } from '@/src/components/pk/PkAuthModal';
import { Presskit, PresskitSocial, PresskitMix, PresskitLink, PresskitCustomSection } from '@/src/types/presskit';
import { createClient } from '@/src/lib/supabase';
import { event } from '@/src/lib/gtag';
import { socialToHandle, socialToUrl } from '@/src/lib/socials';
import { RiderData, RiderSetup, PLAYER_MODELS, MIXER_MODELS, parseRider, serializeRider, emptySetup } from '@/src/lib/rider';
import {
  RiSaveLine,
  RiEyeLine,
  RiEyeOffLine,
  RiAddLine,
  RiDeleteBinLine,
  RiLoader4Line,
  RiLogoutBoxLine,
  RiExternalLinkLine,
  RiUploadCloud2Line,
  RiImageLine,
  RiPencilLine,
  RiAlertLine,
  RiCheckLine,
  RiCloseLine,
  RiSoundcloudLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
} from '@remixicon/react';

// Instagram NO va acá: es un campo dedicado y obligatorio del formulario.
const PLATFORM_OPTIONS = [
  'SoundCloud', 'Spotify', 'YouTube',
  'Facebook', 'TikTok', 'Twitter', 'Bandcamp',
];

const MAX_LOGOS = 3;
const LOGO_MAX_SIZE = 3 * 1024 * 1024; // 3MB — logos are lightweight brand assets

const MIX_PLATFORM_OPTIONS = ['SoundCloud', 'YouTube', 'Spotify', 'Bandcamp', 'Mixcloud'];
const MIX_TYPE_OPTIONS: { value: 'set' | 'release'; label: string }[] = [
  { value: 'set', label: 'Set' },
  { value: 'release', label: 'Release' },
];

interface SoundcloudTrackOption {
  id: string;
  title: string;
  url: string;
}

function PresskitEditor() {
  const { user, pkProfile, loading, needsPkProfile, signOut, updateSlug } = usePkAuth();
  const [presskit, setPresskit] = useState<Presskit | null>(null);
  const [loadingPk, setLoadingPk] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Form state
  const [artistName, setArtistName] = useState('');
  const [realName, setRealName] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  // Instagram es un campo dedicado y obligatorio (no vive en la lista de redes).
  const [instagram, setInstagram] = useState('');
  const [genresInput, setGenresInput] = useState('');
  const [bio, setBio] = useState('');
  // Secciones personalizadas (título + contenido) que el DJ agrega tras la bio.
  const [customSections, setCustomSections] = useState<PresskitCustomSection[]>([]);
  const [riderData, setRiderData] = useState<RiderData>({ setups: [] }); // rider técnico estructurado (opcional)
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoUrls, setLogoUrls] = useState<string[]>([]);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [socials, setSocials] = useState<PresskitSocial[]>([]);
  const [mixes, setMixes] = useState<PresskitMix[]>([]);
  const [links, setLinks] = useState<PresskitLink[]>([]);
  const [published, setPublished] = useState(true);
  const [editingSlug, setEditingSlug] = useState(false);
  const [newSlug, setNewSlug] = useState('');
  const [slugError, setSlugError] = useState('');
  const [savingSlug, setSavingSlug] = useState(false);

  // SoundCloud import state
  const [scTracks, setScTracks] = useState<SoundcloudTrackOption[]>([]);
  const [scLoading, setScLoading] = useState(false);
  const [scError, setScError] = useState('');
  const [scSelectedTrack, setScSelectedTrack] = useState<string>('');
  const [scSelectedType, setScSelectedType] = useState<'set' | 'release'>('set');
  const [scDropdownOpen, setScDropdownOpen] = useState(false);
  // Item de tipo set pendiente de confirmar (EP vs playlist).
  const [epPrompt, setEpPrompt] = useState<SoundcloudTrackOption | null>(null);
  const [playlistBlocked, setPlaylistBlocked] = useState(false);

  // ── Cambios sin guardar (dirty) + auto-guardado ───────────────────────────
  // Snapshot en memoria (barato) para saber si hay cambios sin guardar. Los TEXTOS
  // se guardan con botón (no request por letra); los cambios DISCRETOS (dropdowns,
  // toggle publicado, subir/quitar imagen, borrar fila) marcan autoPendingRef y se
  // guardan solos vía el efecto de más abajo.
  const savedRef = useRef('');
  const autoPendingRef = useRef(false);
  const [dirty, setDirty] = useState(false);
  const currentSnapshot = () =>
    JSON.stringify({
      artistName, realName, city, country, instagram, genresInput, bio, customSections, riderData,
      photoUrls, logoUrls, socials, mixes, links, published,
    });

  const fetchPresskit = useCallback(async () => {
    try {
      const res = await fetch('/api/pk');
      if (!res.ok) {
        setLoadingPk(false);
        return;
      }
      const { presskit: pk } = await res.json();
      if (pk) {
        setPresskit(pk);
        const loadedPhotoUrls: string[] =
          pk.photo_urls?.length ? pk.photo_urls : pk.photo_url ? [pk.photo_url] : [];
        // Instagram sale a su campo dedicado; el resto queda en la lista de redes.
        const allSocials = (pk.socials || []).map((s: PresskitSocial) => ({
          platform: s.platform,
          url: socialToHandle(s.platform, s.url),
        }));
        const ig = allSocials.find((s: PresskitSocial) => s.platform === 'Instagram');
        const loadedInstagram = ig?.url || '';
        const loadedSocials = allSocials.filter((s: PresskitSocial) => s.platform !== 'Instagram');
        const loadedGenres = (pk.genres || []).join(', ');
        const loadedLogoUrls: string[] = pk.logo_urls || [];
        const loadedMixes = pk.mixes || [];
        const loadedLinks = pk.links || [];

        setArtistName(pk.artist_name || '');
        setRealName(pk.real_name || '');
        setCity(pk.city || '');
        setCountry(pk.country || '');
        setGenresInput(loadedGenres);
        setBio(pk.bio || '');
        setCustomSections(pk.custom_sections || []);
        setRiderData(parseRider(pk.rider));
        setPhotoUrls(loadedPhotoUrls);
        setLogoUrls(loadedLogoUrls);
        setInstagram(loadedInstagram);
        setSocials(loadedSocials);
        setMixes(loadedMixes);
        setLinks(loadedLinks);
        setPublished(pk.published || false);

        // Snapshot inicial → "dirty" arranca en false. Mismo shape que currentSnapshot.
        savedRef.current = JSON.stringify({
          artistName: pk.artist_name || '', realName: pk.real_name || '', city: pk.city || '',
          country: pk.country || '', instagram: loadedInstagram, genresInput: loadedGenres,
          bio: pk.bio || '', customSections: pk.custom_sections || [], riderData: parseRider(pk.rider), photoUrls: loadedPhotoUrls, logoUrls: loadedLogoUrls,
          socials: loadedSocials, mixes: loadedMixes, links: loadedLinks, published: pk.published || false,
        });
      }
    } catch (err) {
      console.error('Error fetching presskit:', err);
    } finally {
      setLoadingPk(false);
    }
  }, []);

  useEffect(() => {
    if (user && pkProfile) {
      fetchPresskit();
    } else {
      setLoadingPk(false);
    }
  }, [user, pkProfile, fetchPresskit]);

  const compressImage = (file: File, maxWidth = 1200, quality = 0.8): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('No canvas context'));
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Compression failed'))),
          'image/webp',
          quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !user) return;

    // Validate all are images
    const invalidFile = files.find((f) => !f.type.startsWith('image/'));
    if (invalidFile) {
      setSaveMessage('Error: Solo se permiten imágenes');
      return;
    }

    setUploading(true);
    setSaveMessage('');

    const supabase = createClient();
    const newUrls: string[] = [];
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB

    try {
      for (const file of files) {
        let uploadBlob: Blob = file;
        const timestamp = Date.now() + Math.random();
        let filePath: string;

        if (file.size > MAX_SIZE) {
          uploadBlob = await compressImage(file);
          filePath = `${user.id}/photo-${timestamp}.webp`;
        } else {
          const ext = file.name.split('.').pop() || 'jpg';
          filePath = `${user.id}/photo-${timestamp}.${ext}`;
        }

        const { error: uploadError } = await supabase.storage
          .from('pk-photos')
          .upload(filePath, uploadBlob, { upsert: true });

        if (uploadError) {
          setSaveMessage(`Error: ${uploadError.message}`);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('pk-photos')
          .getPublicUrl(filePath);

        newUrls.push(`${publicUrl}?t=${Date.now()}`);
      }

      if (newUrls.length > 0) {
        autoPendingRef.current = true; // subir foto → auto-guardar
        setPhotoUrls((prev) => [...prev, ...newUrls]);
        setSaveMessage(`${newUrls.length} foto(s) subida(s) correctamente`);
        setTimeout(() => setSaveMessage(''), 3000);
      }
    } catch {
      setSaveMessage('Error al subir las fotos');
    } finally {
      setUploading(false);
      // Reset input so same files can be selected again
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !user) return;

    const invalidFile = files.find((f) => !f.type.startsWith('image/'));
    if (invalidFile) {
      setSaveMessage('Error: Solo se permiten imágenes');
      if (logoInputRef.current) logoInputRef.current.value = '';
      return;
    }

    // Enforce the max of 3 logos, counting what's already uploaded.
    const remaining = MAX_LOGOS - logoUrls.length;
    if (remaining <= 0) {
      setSaveMessage(`Error: Máximo ${MAX_LOGOS} logos`);
      if (logoInputRef.current) logoInputRef.current.value = '';
      return;
    }
    const toUpload = files.slice(0, remaining);

    // Logos are brand assets — upload originals, no compression. Enforce a
    // sane size cap so we don't accept full-res photos as "logos".
    const oversized = toUpload.find((f) => f.size > LOGO_MAX_SIZE);
    if (oversized) {
      setSaveMessage('Error: Cada logo debe pesar máximo 3MB');
      if (logoInputRef.current) logoInputRef.current.value = '';
      return;
    }

    setUploadingLogo(true);
    setSaveMessage('');

    const supabase = createClient();
    const newUrls: string[] = [];

    try {
      for (const file of toUpload) {
        const timestamp = Date.now() + Math.random();
        const ext = file.name.split('.').pop() || 'png';
        const filePath = `${user.id}/logo-${timestamp}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('pk-photos')
          .upload(filePath, file, { upsert: true, contentType: file.type });

        if (uploadError) {
          setSaveMessage(`Error: ${uploadError.message}`);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('pk-photos')
          .getPublicUrl(filePath);

        newUrls.push(`${publicUrl}?t=${Date.now()}`);
      }

      if (newUrls.length > 0) {
        autoPendingRef.current = true; // subir logo → auto-guardar
        setLogoUrls((prev) => [...prev, ...newUrls]);
        setSaveMessage(`${newUrls.length} logo(s) subido(s) correctamente`);
        setTimeout(() => setSaveMessage(''), 3000);
      }
    } catch {
      setSaveMessage('Error al subir los logos');
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const persist = async (validate: boolean) => {
    const genres = genresInput.split(',').map((g) => g.trim()).filter(Boolean);

    // Instagram (dedicado y obligatorio) va primero en las redes; el resto detrás.
    const igHandle = socialToHandle('Instagram', instagram);
    const resolvedSocials = [
      ...(igHandle ? [{ platform: 'Instagram', url: igHandle }] : []),
      ...socials
        .filter((s) => s.url.trim() && s.platform !== 'Instagram')
        .map((s) => ({ platform: s.platform, url: socialToHandle(s.platform, s.url) })),
    ];
    const filteredMixes = mixes.filter((m) => m.title.trim() && m.url.trim());
    const filteredLinks = links.filter((l) => l.title.trim() && l.url.trim());

    // Mínimo obligatorio para que exista un DJ: AKA, nombre real, ciudad, país,
    // Instagram y al menos una foto. NUNCA se persiste (ni por auto-guardado) un
    // presskit sin esto, así no quedan perfiles de DJ a medio llenar. En el
    // guardado manual se explica qué falta; en el auto-guardado se omite en
    // silencio (queda "sin guardar" hasta completar).
    const meetsMinimum =
      artistName.trim() && realName.trim() && city.trim() && country.trim() &&
      instagram.trim() && photoUrls.length > 0;
    if (!meetsMinimum) {
      if (validate) {
        setSaveMessage(
          photoUrls.length === 0 && artistName.trim() && realName.trim() && city.trim() && country.trim() && instagram.trim()
            ? 'Error: Debes subir al menos una foto para tu presskit'
            : 'Error: Completa AKA de DJ, nombre real, ciudad, país, Instagram y una foto'
        );
      }
      return;
    }

    // Validación adicional (filas vacías, tope de logos) solo en guardado manual.
    if (validate) {
      if (
        socials.some((s) => !s.url.trim()) ||
        mixes.some((m) => !m.title.trim() || !m.url.trim()) ||
        links.some((l) => !l.title.trim() || !l.url.trim())
      ) {
        setSaveMessage('Error: Completa o elimina los campos vacíos marcados en rojo');
        return;
      }
      if (logoUrls.length > MAX_LOGOS) {
        setSaveMessage(`Error: Máximo ${MAX_LOGOS} logos. Elimina ${logoUrls.length - MAX_LOGOS}.`);
        return;
      }
    }

    const body = {
      artist_name: artistName, real_name: realName, city, country, genres, bio,
      custom_sections: customSections
        .map((s) => ({ title: s.title.trim(), body: s.body.trim() }))
        .filter((s) => s.title && s.body),
      rider: serializeRider(riderData),
      photo_urls: photoUrls, logo_urls: logoUrls, socials: resolvedSocials,
      mixes: filteredMixes, links: filteredLinks, published,
    };

    setSaving(true);
    setSaveMessage('');
    try {
      const method = presskit ? 'PUT' : 'POST';
      const res = await fetch('/api/pk', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveMessage(`Error: ${data.error}`);
      } else {
        setPresskit(data.presskit);
        event(method === 'POST' ? 'presskit_created' : 'presskit_saved');
        savedRef.current = currentSnapshot();
        setDirty(false);
        setSaveMessage(validate ? 'Guardado correctamente' : 'Cambios guardados');
        setTimeout(() => setSaveMessage(''), 2500);
      }
    } catch {
      setSaveMessage('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => persist(true);

  // ¿Hay cambios sin guardar? Compara el snapshot actual contra el último guardado.
  useEffect(() => {
    setDirty(currentSnapshot() !== savedRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artistName, realName, city, country, instagram, genresInput, bio, customSections, riderData, photoUrls, logoUrls, socials, mixes, links, published]);

  // Auto-guardado: solo cuando un cambio DISCRETO marcó autoPendingRef (los textos no).
  useEffect(() => {
    if (!autoPendingRef.current) return;
    autoPendingRef.current = false;
    void persist(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoUrls, logoUrls, socials, mixes, links, published]);

  // Social handlers
  const addSocial = () => setSocials([...socials, { platform: 'SoundCloud', url: '' }]);
  const removeSocial = (i: number) => { autoPendingRef.current = true; setSocials(socials.filter((_, idx) => idx !== i)); };
  const updateSocial = (i: number, field: keyof PresskitSocial, value: string) => {
    const updated = [...socials];
    updated[i] = { ...updated[i], [field]: value };
    setSocials(updated);
  };

  // Mix handlers
  const addMix = () => setMixes([...mixes, { title: '', platform: 'SoundCloud', url: '', type: 'set' }]);
  const removeMix = (i: number) => { autoPendingRef.current = true; setMixes(mixes.filter((_, idx) => idx !== i)); };
  const updateMix = (i: number, field: keyof PresskitMix, value: string | PresskitMix['type']) => {
    if (field !== 'title' && field !== 'url') autoPendingRef.current = true; // dropdowns → auto
    const updated = [...mixes];
    updated[i] = { ...updated[i], [field]: value };
    // Si cambia la URL de un release marcado, invalida la fecha para recapturarla al guardar.
    if (field === 'url') updated[i].released_at = null;
    setMixes(updated);
  };

  // "Publicar en Releases Nacionales": la fecha (released_at) la captura el
  // backend desde SoundCloud al guardar; aquí solo alternamos el flag.
  const toggleMixFeatured = (i: number) => {
    autoPendingRef.current = true;
    const updated = [...mixes];
    const turningOn = !updated[i].featured;
    updated[i] = { ...updated[i], featured: turningOn };
    setMixes(updated);
    if (turningOn) event('release_publish', { title: updated[i].title });
  };

  // Link handlers
  const addLink = () => setLinks([...links, { title: '', url: '' }]);
  const removeLink = (i: number) => { autoPendingRef.current = true; setLinks(links.filter((_, idx) => idx !== i)); };
  const updateLink = (i: number, field: keyof PresskitLink, value: string) => {
    const updated = [...links];
    updated[i] = { ...updated[i], [field]: value };
    setLinks(updated);
  };

  // Secciones personalizadas (título + contenido), mostradas tras la bio.
  const addCustomSection = () => setCustomSections([...customSections, { title: '', body: '' }]);
  const removeCustomSection = (i: number) => setCustomSections(customSections.filter((_, idx) => idx !== i));
  const updateCustomSection = (i: number, field: keyof PresskitCustomSection, value: string) =>
    setCustomSections(customSections.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));
  const moveCustomSection = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= customSections.length) return;
    const updated = [...customSections];
    [updated[i], updated[j]] = [updated[j], updated[i]];
    setCustomSections(updated);
  };

  // SoundCloud helpers
  const soundcloudUrl = socials.find(
    (s) => s.platform === 'SoundCloud' && s.url.trim()
  )?.url;

  const hasSoundcloud = Boolean(soundcloudUrl);

  const fetchScTracks = async () => {
    if (!soundcloudUrl) return;
    setScLoading(true);
    setScError('');
    setScTracks([]);
    setScSelectedTrack('');
    setScDropdownOpen(true);

    try {
      const resolvedUrl = socialToUrl('SoundCloud', soundcloudUrl);
      const res = await fetch(`/api/pk/soundcloud?url=${encodeURIComponent(resolvedUrl)}`);
      const data = await res.json();
      if (!res.ok) {
        setScError(data.error || 'Error al cargar tracks');
        return;
      }
      const existingUrls = new Set(mixes.map((m) => m.url));
      const available = (data.tracks || []).filter(
        (t: SoundcloudTrackOption) => !existingUrls.has(t.url)
      );
      setScTracks(available);
      if (available.length > 0) {
        setScSelectedTrack(String(available[0].id));
      }
    } catch {
      setScError('Error al conectar con SoundCloud');
    } finally {
      setScLoading(false);
    }
  };

  // Un item de SoundCloud es un "set" (URL /sets/…) cuando es un EP, álbum o
  // playlist. No podemos distinguir un EP de una playlist automáticamente, así
  // que se lo preguntamos al artista y bloqueamos las playlists.
  const isSetUrl = (url: string) => /soundcloud\.com\/[^/]+\/sets\//i.test(url);

  const addMixEntry = (track: SoundcloudTrackOption, isEp: boolean) => {
    autoPendingRef.current = true; // importar desde SoundCloud → auto-guardar
    setMixes([
      ...mixes,
      {
        title: track.title,
        platform: 'SoundCloud',
        url: track.url,
        // Un EP es un release (aparece en Releases Nacionales); marcamos is_ep.
        type: isEp ? 'release' : scSelectedType,
        ...(isEp ? { is_ep: true } : {}),
      },
    ]);
    setScDropdownOpen(false);
    setScSelectedTrack('');
    setScTracks([]);
    setEpPrompt(null);
  };

  const addScTrack = () => {
    const track = scTracks.find((t) => String(t.id) === scSelectedTrack);
    if (!track) return;
    // Si es un set, preguntamos EP vs playlist antes de agregar.
    if (isSetUrl(track.url)) {
      setEpPrompt(track);
      return;
    }
    addMixEntry(track, false);
  };

  // Show auth modal if not logged in or needs profile
  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center p-12">
        <RiLoader4Line className="w-8 h-8 animate-spin" />
      </main>
    );
  }

  if (!user || needsPkProfile) {
    return (
      <main className="flex-1">
        <PkAuthModal isOpen={true} />
      </main>
    );
  }

  if (loadingPk) {
    return (
      <main className="flex-1 flex items-center justify-center p-12">
        <RiLoader4Line className="w-8 h-8 animate-spin" />
      </main>
    );
  }

  const inputClass =
    'w-full px-4 py-3 bg-white brutalist-border text-black font-mono text-sm focus:shadow-[4px_4px_0px_0px_rgba(255,0,85,1)] focus:outline-none transition-all';
  const labelClass = 'mono text-sm font-bold uppercase block mb-1';

  return (
    <main className="flex-1">
      {/* Header */}
      <section className="border-b-4 border-black p-6 lg:p-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl lg:text-6xl font-black uppercase italic tracking-tighter leading-none">
            EDITAR PRESSKIT
          </h1>
          {pkProfile && !editingSlug && (
            <div className="flex items-center gap-2 mt-1">
              <p className="mono text-sm opacity-60">/pk/{pkProfile.slug}</p>
              <button
                onClick={() => { setEditingSlug(true); setNewSlug(pkProfile.slug); setSlugError(''); }}
                className="p-1 opacity-40 hover:opacity-100 transition-opacity"
                title="Cambiar URL"
              >
                <RiPencilLine className="w-4 h-4" />
              </button>
            </div>
          )}
          {pkProfile && editingSlug && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <span className="mono text-sm opacity-60">/pk/</span>
                <input
                  type="text"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="px-3 py-1 bg-white brutalist-border text-black font-mono text-sm focus:shadow-[4px_4px_0px_0px_rgba(255,0,85,1)] focus:outline-none w-48"
                  minLength={3}
                  maxLength={30}
                />
                <button
                  onClick={async () => {
                    if (newSlug === pkProfile.slug) { setEditingSlug(false); return; }
                    setSavingSlug(true);
                    setSlugError('');
                    const { error } = await updateSlug(newSlug);
                    if (error) { setSlugError(error.message); }
                    else { setEditingSlug(false); }
                    setSavingSlug(false);
                  }}
                  disabled={savingSlug || newSlug.length < 3}
                  className="p-1 text-green-600 hover:text-green-800 transition-colors disabled:opacity-30"
                  title="Confirmar"
                >
                  {savingSlug ? <RiLoader4Line className="w-5 h-5 animate-spin" /> : <RiCheckLine className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => setEditingSlug(false)}
                  className="p-1 text-red-500 hover:text-red-700 transition-colors"
                  title="Cancelar"
                >
                  <RiCloseLine className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-start gap-2 p-2 bg-yellow-50 border-2 border-yellow-400 text-yellow-800 mono text-[11px]">
                <RiAlertLine className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Al cambiar tu URL, los links anteriores (/pk/{pkProfile.slug}) dejarán de funcionar.</span>
              </div>
              {slugError && (
                <p className="mono text-xs text-red-500">{slugError}</p>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-3 items-center">
          {pkProfile && published && (
            <a
              href={`/pk/${pkProfile.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mono text-xs font-bold uppercase px-4 py-2 brutalist-border hover:bg-black hover:text-white transition-colors"
            >
              <RiExternalLinkLine className="w-4 h-4" />
              VER PÚBLICO
            </a>
          )}
          <button
            onClick={async () => {
              await signOut();
              window.location.href = '/';
            }}
            className="inline-flex items-center gap-2 mono text-xs font-bold uppercase px-4 py-2 brutalist-border hover:bg-black hover:text-white transition-colors"
          >
            <RiLogoutBoxLine className="w-4 h-4" />
            SALIR
          </button>
        </div>
      </section>

      {/* Form */}
      <section className="p-6 lg:p-12 max-w-4xl">
        <div className="space-y-6">
          {/* Basic info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>AKA de DJ *</label>
              <input
                type="text"
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                className={inputClass}
                placeholder="DJ SYNKRO"
                required
              />
            </div>
            <div>
              <label className={labelClass}>Nombre real *</label>
              <input
                type="text"
                value={realName}
                onChange={(e) => setRealName(e.target.value)}
                className={inputClass}
                placeholder="Carlos Mendoza"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Ciudad *</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={inputClass}
                placeholder="Santiago"
                required
              />
            </div>
            <div>
              <label className={labelClass}>País *</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={inputClass}
                placeholder="Chile"
                required
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Instagram *</label>
            <input
              type="text"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              className={inputClass}
              placeholder="tu_usuario"
              required
            />
            <p className="mono text-[10px] opacity-40 mt-1">
              Solo tu usuario (ej. <span className="font-bold">tu_usuario</span>), sin la URL.
            </p>
          </div>

          <div>
            <label className={labelClass}>Géneros (separados por coma)</label>
            <input
              type="text"
              value={genresInput}
              onChange={(e) => setGenresInput(e.target.value)}
              className={inputClass}
              placeholder="Drum and Bass, Liquid, Neurofunk"
            />
          </div>

          <div>
            <label className={labelClass}>Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className={`${inputClass} min-h-[120px] resize-y`}
              placeholder="Cuéntanos sobre ti..."
              rows={4}
            />
          </div>

          {/* Secciones personalizadas: título libre + contenido, tras la bio. */}
          <div className="border-4 border-black p-4 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <label className={labelClass}>Secciones personalizadas (opcional)</label>
                <p className="mono text-[11px] text-gray-500 -mt-1">
                  Agrega las secciones que quieras (Discografía, Prensa, Contacto…). Aparecen después de tu bio.
                </p>
              </div>
              <button
                type="button"
                onClick={addCustomSection}
                className="shrink-0 mono text-xs font-bold uppercase px-3 py-1.5 brutalist-border bg-black text-white hover:bg-gray-900"
              >
                + Sección
              </button>
            </div>

            {customSections.length === 0 && (
              <p className="mono text-xs text-gray-500">Sin secciones aún. Agrega una para sumar contenido a tu presskit.</p>
            )}

            {customSections.map((sec, i) => (
              <div key={i} className="border-2 border-black p-3 space-y-2 bg-gray-50">
                <div className="flex items-center gap-2">
                  <input
                    value={sec.title}
                    onChange={(e) => updateCustomSection(i, 'title', e.target.value)}
                    placeholder="Título de la sección (ej. Discografía)"
                    className={`${inputClass} flex-1 font-bold uppercase`}
                  />
                  <button
                    type="button"
                    onClick={() => moveCustomSection(i, -1)}
                    disabled={i === 0}
                    aria-label="Subir sección"
                    className="shrink-0 mono text-xs font-bold px-2.5 py-1.5 brutalist-border hover:bg-gray-100 disabled:opacity-30 disabled:cursor-default"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveCustomSection(i, 1)}
                    disabled={i === customSections.length - 1}
                    aria-label="Bajar sección"
                    className="shrink-0 mono text-xs font-bold px-2.5 py-1.5 brutalist-border hover:bg-gray-100 disabled:opacity-30 disabled:cursor-default"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCustomSection(i)}
                    aria-label="Quitar sección"
                    className="shrink-0 mono text-xs font-bold uppercase px-2.5 py-1.5 brutalist-border border-red-600 text-red-600 hover:bg-red-50"
                  >
                    ×
                  </button>
                </div>
                <textarea
                  value={sec.body}
                  onChange={(e) => updateCustomSection(i, 'body', e.target.value)}
                  placeholder="Contenido de la sección…"
                  className={`${inputClass} min-h-[100px] resize-y`}
                  rows={4}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!dirty || saving}
                    className="brutalist-border bg-black text-white px-5 py-1.5 mono text-xs font-bold uppercase hover:bg-gray-900 disabled:opacity-40 disabled:cursor-default cursor-pointer"
                  >
                    {saving ? 'Guardando…' : 'Guardar'}
                  </button>
                  <span className={`mono text-[11px] font-bold uppercase ${dirty ? 'text-[#ff0055]' : 'text-green-600'}`}>
                    {saving ? '' : dirty ? '● Sin guardar' : '✓ Guardado'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="border-4 border-black p-4 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <label className={labelClass}>Rider técnico (opcional)</label>
                <p className="mono text-[11px] text-gray-500 -mt-1">
                  Uno o varios setups (club, alternativo, festival…). Si completas algo, aparece en tu presskit.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRiderData((d) => ({ ...d, setups: [...d.setups, emptySetup()] }))}
                className="shrink-0 mono text-xs font-bold uppercase px-3 py-1.5 brutalist-border bg-black text-white hover:bg-gray-900"
              >
                + Setup
              </button>
            </div>

            {riderData.setups.length === 0 && (
              <p className="mono text-xs text-gray-500">Sin setups aún. Agrega uno para especificar tu equipo.</p>
            )}

            {riderData.setups.map((s, si) => {
              const upd = (patch: Partial<RiderSetup>) =>
                setRiderData((d) => ({ ...d, setups: d.setups.map((x, i) => (i === si ? { ...x, ...patch } : x)) }));
              return (
                <div key={si} className="border-2 border-black p-3 space-y-3 bg-gray-50">
                  <div className="flex items-center gap-2">
                    <input
                      value={s.name || ''}
                      onChange={(e) => upd({ name: e.target.value })}
                      placeholder={`Setup ${si + 1} (nombre opcional)`}
                      className={`${inputClass} flex-1`}
                    />
                    <button
                      type="button"
                      onClick={() => setRiderData((d) => ({ ...d, setups: d.setups.filter((_, i) => i !== si) }))}
                      aria-label="Quitar setup"
                      className="shrink-0 mono text-xs font-bold uppercase px-2.5 py-1.5 brutalist-border border-red-600 text-red-600 hover:bg-red-50"
                    >
                      ×
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                    <label className="flex-1 mono text-xs font-bold uppercase">
                      Reproductores
                      <select
                        value={s.players?.model || ''}
                        onChange={(e) => upd({ players: e.target.value ? { model: e.target.value, quantity: s.players?.quantity || 2 } : undefined })}
                        className={`${inputClass} mt-1`}
                      >
                        <option value="">— Sin especificar —</option>
                        {PLAYER_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </label>
                    <label className="mono text-xs font-bold uppercase sm:w-28">
                      Cantidad
                      <input
                        type="number"
                        min={1}
                        max={8}
                        disabled={!s.players?.model}
                        // Permite vaciar el campo mientras se edita (queda 0 → se
                        // muestra vacío); al guardar se normaliza a mínimo 1.
                        value={s.players?.quantity || ''}
                        onChange={(e) => upd({ players: s.players ? { ...s.players, quantity: e.target.value === '' ? 0 : Math.min(8, Math.max(0, +e.target.value || 0)) } : s.players })}
                        onBlur={(e) => { if (e.target.value === '' || +e.target.value < 1) upd({ players: s.players ? { ...s.players, quantity: 1 } : s.players }); }}
                        className={`${inputClass} mt-1 disabled:opacity-40`}
                      />
                    </label>
                  </div>

                  <label className="block mono text-xs font-bold uppercase">
                    Mixer
                    <select value={s.mixer || ''} onChange={(e) => upd({ mixer: e.target.value || undefined })} className={`${inputClass} mt-1`}>
                      <option value="">— Sin especificar —</option>
                      {MIXER_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </label>
                </div>
              );
            })}

            <label className="block mono text-xs font-bold uppercase">
              Notas generales
              <textarea
                value={riderData.notes || ''}
                onChange={(e) => setRiderData((d) => ({ ...d, notes: e.target.value || undefined }))}
                className={`${inputClass} mt-1 min-h-[60px] resize-y normal-case`}
                placeholder="Aplican a todos los setups (opcional)"
                rows={2}
              />
            </label>
          </div>

          {/* Barra de guardado: los textos se guardan acá; los dropdowns/uploads solos. */}
          <div className="flex flex-wrap items-center gap-3 border-4 border-black bg-gray-50 p-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving}
              className="brutalist-border bg-black text-white px-6 py-2 mono text-sm font-bold uppercase hover:bg-gray-900 disabled:opacity-40 disabled:cursor-default cursor-pointer"
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
            <span
              className={`mono text-xs font-bold uppercase ${dirty ? 'text-[#ff0055]' : 'text-green-600'}`}
            >
              {saving ? '' : dirty ? '● Hay cambios sin guardar' : '✓ Todos los cambios guardados'}
            </span>
          </div>

          <div>
            <label className={labelClass}>Fotos</label>
            <div className="flex flex-wrap gap-3 mb-3">
              {photoUrls.map((url, i) => (
                <div key={url} className="relative group">
                  <img
                    src={url}
                    alt={`Foto ${i + 1}`}
                    className={`w-28 h-28 object-cover brutalist-border shrink-0 ${i === 0 ? 'ring-2 ring-[#ff0055]' : ''}`}
                  />
                  {i === 0 && (
                    <span className="absolute top-0 left-0 bg-[#ff0055] text-white mono text-[9px] font-bold px-1.5 py-0.5">
                      PRINCIPAL
                    </span>
                  )}
                  <div className="absolute top-1 right-1 flex gap-0.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    {i > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...photoUrls];
                          [updated[i - 1], updated[i]] = [updated[i], updated[i - 1]];
                          setPhotoUrls(updated);
                        }}
                        className="p-1 bg-white brutalist-border hover:bg-black hover:text-white transition-colors"
                        title="Mover a la izquierda"
                      >
                        <RiArrowLeftSLine className="w-3 h-3" />
                      </button>
                    )}
                    {i < photoUrls.length - 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...photoUrls];
                          [updated[i], updated[i + 1]] = [updated[i + 1], updated[i]];
                          setPhotoUrls(updated);
                        }}
                        className="p-1 bg-white brutalist-border hover:bg-black hover:text-white transition-colors"
                        title="Mover a la derecha"
                      >
                        <RiArrowRightSLine className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        // Extract storage path from URL and delete from storage
                        try {
                          const urlObj = new URL(url.split('?')[0]);
                          const pathMatch = urlObj.pathname.match(/pk-photos\/(.+)$/);
                          if (pathMatch) {
                            const supabase = createClient();
                            await supabase.storage.from('pk-photos').remove([pathMatch[1]]);
                          }
                        } catch { /* ignore storage errors */ }
                        autoPendingRef.current = true;
                        setPhotoUrls((prev) => prev.filter((_, idx) => idx !== i));
                      }}
                      className="p-1 bg-white brutalist-border hover:bg-red-500 hover:text-white transition-colors"
                      title="Eliminar"
                    >
                      <RiDeleteBinLine className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
              {photoUrls.length === 0 && (
                <div className="w-28 h-28 bg-gray-200 brutalist-border flex items-center justify-center shrink-0">
                  <RiImageLine className="w-8 h-8 opacity-30" />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleUploadPhoto}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 mono text-xs font-bold uppercase px-4 py-3 brutalist-border hover:bg-black hover:text-white transition-colors disabled:opacity-50 w-fit"
              >
                {uploading ? (
                  <RiLoader4Line className="w-4 h-4 animate-spin" />
                ) : (
                  <RiUploadCloud2Line className="w-4 h-4" />
                )}
                {uploading ? 'SUBIENDO...' : 'SUBIR IMAGEN'}
              </button>
              {photoUrls.length > 5 ? (
                <p className="mono text-xs font-bold text-red-500">
                  Tienes {photoUrls.length} fotos. Elimina {photoUrls.length - 5} para poder guardar (máximo 5).
                </p>
              ) : (
                <p className="mono text-[10px] opacity-40">
                  JPG, PNG o WebP. Imágenes grandes se comprimen automáticamente. La primera foto es la principal. ({photoUrls.length}/5)
                </p>
              )}
            </div>
          </div>

          {/* Logos */}
          <div>
            <label className={labelClass}>Logos</label>
            <p className="mono text-[10px] opacity-40 mb-3">
              Sube hasta {MAX_LOGOS} logos (PNG con transparencia, JPG o WebP). Quienes visiten tu
              perfil podrán descargarlos todos en un ZIP. ({logoUrls.length}/{MAX_LOGOS})
            </p>
            <div className="flex flex-wrap gap-3 mb-3">
              {logoUrls.map((url, i) => (
                <div key={url} className="relative group">
                  <img
                    src={url}
                    alt={`Logo ${i + 1}`}
                    className="w-28 h-28 object-contain bg-[repeating-conic-gradient(#e5e5e5_0_25%,#ffffff_0_50%)] bg-[length:16px_16px] brutalist-border shrink-0"
                  />
                  <div className="absolute top-1 right-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const urlObj = new URL(url.split('?')[0]);
                          const pathMatch = urlObj.pathname.match(/pk-photos\/(.+)$/);
                          if (pathMatch) {
                            const supabase = createClient();
                            await supabase.storage.from('pk-photos').remove([pathMatch[1]]);
                          }
                        } catch { /* ignore storage errors */ }
                        autoPendingRef.current = true;
                        setLogoUrls((prev) => prev.filter((_, idx) => idx !== i));
                      }}
                      className="p-1 bg-white brutalist-border hover:bg-red-500 hover:text-white transition-colors"
                      title="Eliminar"
                    >
                      <RiDeleteBinLine className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
              {logoUrls.length === 0 && (
                <div className="w-28 h-28 bg-gray-200 brutalist-border flex items-center justify-center shrink-0">
                  <RiImageLine className="w-8 h-8 opacity-30" />
                </div>
              )}
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleUploadLogo}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              disabled={uploadingLogo || logoUrls.length >= MAX_LOGOS}
              className="inline-flex items-center gap-2 mono text-xs font-bold uppercase px-4 py-3 brutalist-border hover:bg-black hover:text-white transition-colors disabled:opacity-50 w-fit"
            >
              {uploadingLogo ? (
                <RiLoader4Line className="w-4 h-4 animate-spin" />
              ) : (
                <RiUploadCloud2Line className="w-4 h-4" />
              )}
              {uploadingLogo ? 'SUBIENDO...' : 'SUBIR LOGO'}
            </button>
            {logoUrls.length >= MAX_LOGOS && (
              <p className="mono text-[10px] opacity-40 mt-2">
                Alcanzaste el máximo de {MAX_LOGOS} logos. Elimina uno para subir otro.
              </p>
            )}
          </div>

          {/* Socials */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className={labelClass}>Redes sociales</label>
              <button
                type="button"
                onClick={addSocial}
                className="inline-flex items-center gap-1 mono text-xs font-bold uppercase px-3 py-1 brutalist-border hover:bg-black hover:text-white transition-colors"
              >
                <RiAddLine className="w-4 h-4" />
                AGREGAR
              </button>
            </div>
            <div className="space-y-3">
              {socials.map((social, i) => (
                <div key={i} className="brutalist-border p-4 space-y-3">
                  <div className="flex gap-2 items-center">
                    <select
                      value={social.platform}
                      onChange={(e) => updateSocial(i, 'platform', e.target.value)}
                      className={`${inputClass} flex-1`}
                    >
                      {PLATFORM_OPTIONS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeSocial(i)}
                      className="p-3 brutalist-border hover:bg-red-500 hover:text-white transition-colors shrink-0"
                    >
                      <RiDeleteBinLine className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={social.url}
                    onChange={(e) => updateSocial(i, 'url', e.target.value)}
                    className={`${inputClass} ${!social.url.trim() ? '!border-red-500' : ''}`}
                    placeholder="Solo tu nombre de usuario"
                  />
                  <p className="mono text-[10px] opacity-40">
                    Solo el usuario (ej. <span className="font-bold">tu_usuario</span>), no la URL
                    completa. Si pegas la URL, la recortamos sola.
                  </p>
                </div>
              ))}
              {socials.length === 0 && (
                <p className="mono text-xs opacity-40">Sin redes sociales agregadas</p>
              )}
            </div>
          </div>

          {/* Mixes */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className={labelClass}>Sets & Releases</label>
              <div className="flex gap-2">
                {hasSoundcloud && (
                  <button
                    type="button"
                    onClick={fetchScTracks}
                    disabled={scLoading}
                    className="inline-flex items-center gap-1 mono text-xs font-bold uppercase px-3 py-1 brutalist-border hover:bg-[#ff5500] hover:text-white transition-colors"
                  >
                    {scLoading ? (
                      <RiLoader4Line className="w-4 h-4 animate-spin" />
                    ) : (
                      <RiSoundcloudLine className="w-4 h-4" />
                    )}
                    AGREGAR DESDE SOUNDCLOUD
                  </button>
                )}
                <button
                  type="button"
                  onClick={addMix}
                  className="inline-flex items-center gap-1 mono text-xs font-bold uppercase px-3 py-1 brutalist-border hover:bg-black hover:text-white transition-colors"
                >
                  <RiAddLine className="w-4 h-4" />
                  AGREGAR MANUAL
                </button>
              </div>
            </div>

            {/* SoundCloud message when no SC in socials */}
            {!hasSoundcloud && (
              <div className="flex items-start gap-2 p-3 bg-orange-50 border-2 border-orange-300 text-orange-800 mono text-xs mb-3">
                <RiSoundcloudLine className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Agrega tu SoundCloud en redes sociales para importar tus tracks.</span>
              </div>
            )}

            {/* SoundCloud import dropdown */}
            {scDropdownOpen && (
              <div className="brutalist-border p-4 mb-3 space-y-3 bg-gray-50">
                {scLoading && (
                  <div className="flex items-center gap-2 mono text-xs">
                    <RiLoader4Line className="w-4 h-4 animate-spin" />
                    Cargando tracks de SoundCloud...
                  </div>
                )}
                {scError && (
                  <p className="mono text-xs text-red-500">{scError}</p>
                )}
                {!scLoading && scTracks.length > 0 && (
                  <>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        value={scSelectedTrack}
                        onChange={(e) => setScSelectedTrack(e.target.value)}
                        className={`${inputClass} flex-1`}
                      >
                        {scTracks.map((t) => (
                          <option key={t.id} value={String(t.id)}>
                            {t.title}
                          </option>
                        ))}
                      </select>
                      <select
                        value={scSelectedType}
                        onChange={(e) => setScSelectedType(e.target.value as 'set' | 'release')}
                        className={`${inputClass} sm:w-32`}
                      >
                        {MIX_TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={addScTrack}
                        className="inline-flex items-center gap-1 mono text-xs font-bold uppercase px-3 py-1 brutalist-border bg-[#ff5500] text-white hover:bg-[#cc4400] transition-colors"
                      >
                        <RiAddLine className="w-4 h-4" />
                        AGREGAR
                      </button>
                      <button
                        type="button"
                        onClick={() => { setScDropdownOpen(false); setScTracks([]); setScError(''); setEpPrompt(null); setPlaylistBlocked(false); }}
                        className="inline-flex items-center gap-1 mono text-xs font-bold uppercase px-3 py-1 brutalist-border hover:bg-black hover:text-white transition-colors"
                      >
                        CANCELAR
                      </button>
                    </div>

                    {/* Prompt EP vs playlist para items de tipo set */}
                    {epPrompt && (
                      <div className="brutalist-border bg-yellow-50 p-3 space-y-2">
                        <p className="mono text-xs font-bold uppercase">
                          «{epPrompt.title}» es un set de SoundCloud. ¿Qué es?
                        </p>
                        <p className="mono text-[11px] opacity-70 normal-case">
                          Un EP se publica en Releases Nacionales. Una playlist (recopilatorio)
                          no se puede publicar.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => { setPlaylistBlocked(false); addMixEntry(epPrompt, true); }}
                            className="inline-flex items-center gap-1 mono text-xs font-bold uppercase px-3 py-1 brutalist-border bg-[#7C3AED] text-white hover:opacity-90 transition-opacity"
                          >
                            ES UN EP
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEpPrompt(null); setPlaylistBlocked(true); }}
                            className="inline-flex items-center gap-1 mono text-xs font-bold uppercase px-3 py-1 brutalist-border hover:bg-black hover:text-white transition-colors"
                          >
                            ES UNA PLAYLIST
                          </button>
                        </div>
                      </div>
                    )}
                    {playlistBlocked && !epPrompt && (
                      <p className="mono text-xs text-red-500 normal-case">
                        Las playlists no se pueden publicar en Releases Nacionales. Elige un
                        track o un EP.
                      </p>
                    )}
                  </>
                )}
                {!scLoading && scTracks.length === 0 && !scError && (
                  <p className="mono text-xs opacity-40">No se encontraron tracks.</p>
                )}
              </div>
            )}

            <div className="space-y-3">
              {mixes.map((mix, i) => {
                const canFeature =
                  mix.type === 'release' &&
                  mix.platform === 'SoundCloud' &&
                  mix.url.trim().length > 0;
                return (
                  <div key={i} className="space-y-2">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={mix.title}
                        onChange={(e) => updateMix(i, 'title', e.target.value)}
                        className={`${inputClass} sm:w-48 ${!mix.title.trim() ? '!border-red-500' : ''}`}
                        placeholder="Título"
                      />
                      <select
                        value={mix.platform}
                        onChange={(e) => updateMix(i, 'platform', e.target.value)}
                        className={`${inputClass} sm:w-36 shrink-0`}
                      >
                        {MIX_PLATFORM_OPTIONS.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      <select
                        value={mix.type || 'set'}
                        onChange={(e) => updateMix(i, 'type', e.target.value)}
                        className={`${inputClass} sm:w-28 shrink-0`}
                      >
                        {MIX_TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <input
                        type="url"
                        value={mix.url}
                        onChange={(e) => updateMix(i, 'url', e.target.value)}
                        className={`${inputClass} ${!mix.url.trim() ? '!border-red-500' : ''}`}
                        placeholder="https://..."
                      />
                      <button
                        type="button"
                        onClick={() => removeMix(i)}
                        className="p-3 brutalist-border hover:bg-red-500 hover:text-white transition-colors shrink-0 self-start"
                      >
                        <RiDeleteBinLine className="w-4 h-4" />
                      </button>
                    </div>
                    {canFeature && (
                      <label className="flex items-center gap-2 mono text-xs font-bold uppercase cursor-pointer select-none pl-1">
                        <input
                          type="checkbox"
                          checked={!!mix.featured}
                          onChange={() => toggleMixFeatured(i)}
                          className="w-4 h-4 accent-[#FF5500]"
                        />
                        <RiSoundcloudLine className="w-4 h-4 text-[#FF5500]" />
                        Publicar en Releases Nacionales
                      </label>
                    )}
                  </div>
                );
              })}
              {mixes.length === 0 && (
                <p className="mono text-xs opacity-40">Sin mixes agregados</p>
              )}
            </div>
          </div>

          {/* Links */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className={labelClass}>Links</label>
              <button
                type="button"
                onClick={addLink}
                className="inline-flex items-center gap-1 mono text-xs font-bold uppercase px-3 py-1 brutalist-border hover:bg-black hover:text-white transition-colors"
              >
                <RiAddLine className="w-4 h-4" />
                AGREGAR
              </button>
            </div>
            <p className="mono text-[10px] opacity-40 mb-3">
              Agrega cualquier link: Linktree, Beatport, demos, riders, etc.
            </p>
            <div className="space-y-3">
              {links.map((link, i) => (
                <div key={i} className="brutalist-border p-4 space-y-3">
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={link.title}
                      onChange={(e) => updateLink(i, 'title', e.target.value)}
                      className={`${inputClass} flex-1 ${!link.title.trim() ? '!border-red-500' : ''}`}
                      placeholder="Título"
                    />
                    <button
                      type="button"
                      onClick={() => removeLink(i)}
                      className="p-3 brutalist-border hover:bg-red-500 hover:text-white transition-colors shrink-0"
                    >
                      <RiDeleteBinLine className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="url"
                    value={link.url}
                    onChange={(e) => updateLink(i, 'url', e.target.value)}
                    className={`${inputClass} ${!link.url.trim() ? '!border-red-500' : ''}`}
                    placeholder="https://..."
                  />
                </div>
              ))}
              {links.length === 0 && (
                <p className="mono text-xs opacity-40">Sin links agregados</p>
              )}
            </div>
          </div>

          {/* Publish toggle */}
          <div className="flex items-center gap-4 p-4 brutalist-border bg-gray-50">
            <button
              type="button"
              onClick={() => {
                event('presskit_publish', { published: !published });
                autoPendingRef.current = true; // toggle publicado → auto-guardar
                setPublished(!published);
              }}
              className={`inline-flex items-center gap-2 mono text-sm font-bold uppercase px-4 py-2 brutalist-border transition-colors ${
                published
                  ? 'bg-black text-white'
                  : 'bg-white text-black hover:bg-gray-100'
              }`}
            >
              {published ? (
                <>
                  <RiEyeLine className="w-4 h-4" />
                  PUBLICADO
                </>
              ) : (
                <>
                  <RiEyeOffLine className="w-4 h-4" />
                  NO PUBLICADO
                </>
              )}
            </button>
            <span className="mono text-xs opacity-60">
              {published
                ? 'Tu presskit es visible públicamente'
                : 'Tu presskit no es visible aún'}
            </span>
          </div>

          {/* Save */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleSave}
              disabled={saving || !dirty || !artistName || photoUrls.length > 5 || logoUrls.length > MAX_LOGOS}
              className="inline-flex items-center gap-2 bg-[#ff0055] text-white px-8 py-3 font-black uppercase tracking-wider brutalist-border border-black hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50"
            >
              {saving ? (
                <RiLoader4Line className="w-5 h-5 animate-spin" />
              ) : (
                <RiSaveLine className="w-5 h-5" />
              )}
              {saving ? 'GUARDANDO...' : 'GUARDAR'}
            </button>
            {saveMessage ? (
              <span className={`mono text-sm font-bold ${saveMessage.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>
                {saveMessage}
              </span>
            ) : (
              <span className={`mono text-xs font-bold uppercase ${dirty ? 'text-[#ff0055]' : 'text-green-600'}`}>
                {dirty ? '● Hay cambios sin guardar' : '✓ Todos los cambios guardados'}
              </span>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function EditPresskitPage() {
  return (
    <PkAuthProvider>
      <PresskitEditor />
    </PkAuthProvider>
  );
}
