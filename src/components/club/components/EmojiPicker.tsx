'use client';

import React, { useRef, useEffect } from 'react';
import Picker from 'emoji-picker-react';
import { Theme, EmojiClickData } from 'emoji-picker-react';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div ref={containerRef} className="absolute bottom-full mb-2 left-0 z-50">
      <Picker
        theme={Theme.DARK}
        onEmojiClick={(emojiData: EmojiClickData) => onSelect(emojiData.emoji)}
        width={300}
        height={350}
        searchPlaceholder="Buscar emoji..."
        previewConfig={{ showPreview: false }}
      />
    </div>
  );
};
