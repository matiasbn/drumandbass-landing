'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface TenorGif {
  id: string;
  title: string;
  media_formats: {
    tinygif: { url: string };
    gif: { url: string };
  };
}

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}

const TENOR_API_KEY = process.env.NEXT_PUBLIC_TENOR_API_KEY || '';

export const GifPicker: React.FC<GifPickerProps> = ({ onSelect, onClose }) => {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<TenorGif[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const fetchGifs = useCallback(async (searchQuery: string) => {
    if (!TENOR_API_KEY) return;
    setLoading(true);
    try {
      const endpoint = searchQuery
        ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(searchQuery)}&key=${TENOR_API_KEY}&limit=20&media_filter=tinygif,gif`
        : `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&limit=20&media_filter=tinygif,gif`;
      const res = await fetch(endpoint);
      const data = await res.json();
      setGifs(data.results || []);
    } catch (err) {
      console.error('Tenor fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load trending on mount
  useEffect(() => {
    fetchGifs('');
  }, [fetchGifs]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchGifs(query);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchGifs]);

  const handleSelect = (gif: TenorGif) => {
    const url = gif.media_formats.gif?.url || gif.media_formats.tinygif.url;
    onSelect(url);
    onClose();
  };

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full mb-2 left-0 z-50 w-[300px] h-[380px] bg-[#1a1a1a] border border-white/20 rounded-lg flex flex-col overflow-hidden"
    >
      <div className="p-2 border-b border-white/10">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar GIFs..."
          className="w-full bg-black/50 border border-white/20 text-white px-3 py-1.5 text-sm font-mono rounded focus:outline-none focus:border-[#ff0055]"
          autoFocus
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading && gifs.length === 0 ? (
          <p className="text-white/30 text-sm text-center py-8">Cargando...</p>
        ) : (
          <div className="grid grid-cols-2 gap-1">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                onClick={() => handleSelect(gif)}
                className="relative overflow-hidden rounded hover:ring-2 hover:ring-[#ff0055] transition-all cursor-pointer"
              >
                <img
                  src={gif.media_formats.tinygif.url}
                  alt={gif.title}
                  className="w-full h-24 object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-2 py-1 border-t border-white/10 text-center">
        <span className="text-white/30 text-[10px] font-mono">Powered by Tenor</span>
      </div>
    </div>
  );
};
