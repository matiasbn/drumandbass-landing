'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PkAuthProvider, usePkAuth } from '@/src/components/pk/PkAuthContext';
import { PkAuthModal } from '@/src/components/pk/PkAuthModal';
import { Presskit, PresskitSocial, PresskitMix } from '@/src/types/presskit';
import { createClient } from '@/src/lib/supabase';
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
} from '@remixicon/react';

const PLATFORM_OPTIONS = [
  'Instagram', 'SoundCloud', 'Spotify', 'YouTube',
  'Facebook', 'TikTok', 'Twitter', 'Bandcamp',
];

const PLATFORM_BASE_URLS: Record<string, string> = {
  Instagram: 'https://instagram.com/',
  SoundCloud: 'https://soundcloud.com/',
  Spotify: 'https://open.spotify.com/artist/',
  YouTube: 'https://youtube.com/@',
  Facebook: 'https://facebook.com/',
  TikTok: 'https://tiktok.com/@',
  Twitter: 'https://x.com/',
  Bandcamp: 'https://',
};

function resolveSocialUrl(platform: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  // If it's already a URL, return as-is
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  // Strip leading @ if present
  const clean = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  const base = PLATFORM_BASE_URLS[platform];
  if (!base) return trimmed;
  return `${base}${clean}`;
}

const MIX_PLATFORM_OPTIONS = ['SoundCloud', 'YouTube', 'Spotify', 'Bandcamp', 'Mixcloud'];

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
  const [genresInput, setGenresInput] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [socials, setSocials] = useState<PresskitSocial[]>([]);
  const [mixes, setMixes] = useState<PresskitMix[]>([]);
  const [published, setPublished] = useState(false);
  const [editingSlug, setEditingSlug] = useState(false);
  const [newSlug, setNewSlug] = useState('');
  const [slugError, setSlugError] = useState('');
  const [savingSlug, setSavingSlug] = useState(false);

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
        setArtistName(pk.artist_name || '');
        setRealName(pk.real_name || '');
        setCity(pk.city || '');
        setCountry(pk.country || '');
        setGenresInput((pk.genres || []).join(', '));
        setBio(pk.bio || '');
        setPhotoUrl(pk.photo_url || '');
        setSocials(pk.socials || []);
        setMixes(pk.mixes || []);
        setPublished(pk.published || false);
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

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      setSaveMessage('Error: Solo se permiten imágenes');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSaveMessage('Error: La imagen no puede superar 5MB');
      return;
    }

    setUploading(true);
    setSaveMessage('');

    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/photo.${ext}`;

      // Upload (upsert to overwrite previous)
      const { error: uploadError } = await supabase.storage
        .from('pk-photos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        setSaveMessage(`Error: ${uploadError.message}`);
        setUploading(false);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('pk-photos')
        .getPublicUrl(filePath);

      // Append cache buster to force refresh
      setPhotoUrl(`${publicUrl}?t=${Date.now()}`);
      setSaveMessage('Foto subida correctamente');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch {
      setSaveMessage('Error al subir la foto');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage('');

    const genres = genresInput
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean);

    const resolvedSocials = socials.map((s) => ({
      platform: s.platform,
      url: resolveSocialUrl(s.platform, s.url),
    }));

    const body = {
      artist_name: artistName,
      real_name: realName,
      city,
      country,
      genres,
      bio,
      photo_url: photoUrl,
      socials: resolvedSocials,
      mixes,
      published,
    };

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
        setSaveMessage('Guardado correctamente');
        setTimeout(() => setSaveMessage(''), 3000);
      }
    } catch {
      setSaveMessage('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  // Social handlers
  const addSocial = () => setSocials([...socials, { platform: 'Instagram', url: '' }]);
  const removeSocial = (i: number) => setSocials(socials.filter((_, idx) => idx !== i));
  const updateSocial = (i: number, field: keyof PresskitSocial, value: string) => {
    const updated = [...socials];
    updated[i] = { ...updated[i], [field]: value };
    setSocials(updated);
  };

  // Mix handlers
  const addMix = () => setMixes([...mixes, { title: '', platform: 'SoundCloud', url: '' }]);
  const removeMix = (i: number) => setMixes(mixes.filter((_, idx) => idx !== i));
  const updateMix = (i: number, field: keyof PresskitMix, value: string) => {
    const updated = [...mixes];
    updated[i] = { ...updated[i], [field]: value };
    setMixes(updated);
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
            onClick={signOut}
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
              <label className={labelClass}>Nombre artístico *</label>
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
              <label className={labelClass}>Nombre real</label>
              <input
                type="text"
                value={realName}
                onChange={(e) => setRealName(e.target.value)}
                className={inputClass}
                placeholder="Carlos Mendoza"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Ciudad</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={inputClass}
                placeholder="Santiago"
              />
            </div>
            <div>
              <label className={labelClass}>País</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={inputClass}
                placeholder="Chile"
              />
            </div>
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

          <div>
            <label className={labelClass}>Foto</label>
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              {/* Preview */}
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt="Preview"
                  className="w-32 h-32 object-cover brutalist-border shrink-0"
                />
              ) : (
                <div className="w-32 h-32 bg-gray-200 brutalist-border flex items-center justify-center shrink-0">
                  <RiImageLine className="w-8 h-8 opacity-30" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUploadPhoto}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 mono text-xs font-bold uppercase px-4 py-3 brutalist-border hover:bg-black hover:text-white transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <RiLoader4Line className="w-4 h-4 animate-spin" />
                  ) : (
                    <RiUploadCloud2Line className="w-4 h-4" />
                  )}
                  {uploading ? 'SUBIENDO...' : 'SUBIR IMAGEN'}
                </button>
                <p className="mono text-[10px] opacity-40">JPG, PNG o WebP. Máx 5MB.</p>
              </div>
            </div>
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
                    className={inputClass}
                    placeholder={`Nombre de usuario o URL completa`}
                  />
                  <p className="mono text-[10px] opacity-40">
                    Ej: @tu_usuario o https://{social.platform.toLowerCase()}.com/tu_usuario
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
              <label className={labelClass}>Mixes & Releases</label>
              <button
                type="button"
                onClick={addMix}
                className="inline-flex items-center gap-1 mono text-xs font-bold uppercase px-3 py-1 brutalist-border hover:bg-black hover:text-white transition-colors"
              >
                <RiAddLine className="w-4 h-4" />
                AGREGAR
              </button>
            </div>
            <div className="space-y-3">
              {mixes.map((mix, i) => (
                <div key={i} className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={mix.title}
                    onChange={(e) => updateMix(i, 'title', e.target.value)}
                    className={`${inputClass} sm:w-48`}
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
                  <input
                    type="url"
                    value={mix.url}
                    onChange={(e) => updateMix(i, 'url', e.target.value)}
                    className={inputClass}
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
              ))}
              {mixes.length === 0 && (
                <p className="mono text-xs opacity-40">Sin mixes agregados</p>
              )}
            </div>
          </div>

          {/* Publish toggle */}
          <div className="flex items-center gap-4 p-4 brutalist-border bg-gray-50">
            <button
              type="button"
              onClick={() => setPublished(!published)}
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
              disabled={saving || !artistName}
              className="inline-flex items-center gap-2 bg-[#ff0055] text-white px-8 py-3 font-black uppercase tracking-wider brutalist-border border-black hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50"
            >
              {saving ? (
                <RiLoader4Line className="w-5 h-5 animate-spin" />
              ) : (
                <RiSaveLine className="w-5 h-5" />
              )}
              {saving ? 'GUARDANDO...' : 'GUARDAR'}
            </button>
            {saveMessage && (
              <span className={`mono text-sm font-bold ${saveMessage.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>
                {saveMessage}
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
