
import React from 'react';

interface BrutalistButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'primary' | 'red' | 'blue' | 'whatsapp' | 'whiteRed' | 'spotify' | 'instagram' | 'soundcloud' | 'youtube' | 'club';
  href?: string;
  external?: boolean;
}

const BrutalistButton: React.FC<BrutalistButtonProps> = ({ 
  children, 
  onClick, 
  className = '', 
  variant = 'primary',
  href,
  external = false
}) => {
  const baseStyles = "px-6 py-3 font-bold uppercase transition-all brutalist-border duration-100 flex items-center justify-center gap-2 mono";
  const variants = {
    primary: "bg-white hover:bg-gray-200 brutalist-shadow",
    red: "bg-[#ff0000] text-white hover:bg-[#ff4d4d] brutalist-shadow-red",
    whiteRed: "bg-[#ffffff] text-black hover:bg-[#ffe0e0] brutalist-shadow-red",
    blue: "bg-[#0000ff] text-white hover:bg-[#4d4dff] brutalist-shadow-blue",
    whatsapp: "bg-[#25D366] text-white hover:bg-[#5ee092] brutalist-shadow-green",
    spotify: "bg-[#1DB954] text-white hover:bg-[#57d17a] brutalist-shadow-spotify",
    instagram: "bg-gradient-to-r from-[#833AB4] via-[#E1306C] to-[#F77737] text-white hover:from-[#a56bcc] hover:via-[#e9638f] hover:to-[#f99b6a] brutalist-shadow-instagram",
    soundcloud: "bg-[#FF5500] text-white hover:bg-[#ff7f40] brutalist-shadow-soundcloud",
    youtube: "bg-[#FF0000] text-white hover:bg-[#ff4d4d] brutalist-shadow-youtube",
    club: "bg-[#7C3AED] text-white hover:bg-[#9b6bf2] brutalist-shadow-club",
  };
  let extra = ''
  if (href) extra = ' cursor-pointer '

  const combinedStyles = `${baseStyles} ${variants[variant]} ${className} ${extra}`.trim();

  if (href) {
    return (
      <a href={href} className={combinedStyles} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
        {children}
      </a>
    );
  }

  return (
    <button onClick={onClick} className={combinedStyles}>
      {children}
    </button>
  );
};

export default BrutalistButton;
