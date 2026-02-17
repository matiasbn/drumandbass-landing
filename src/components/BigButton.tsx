
import React from 'react';

interface BrutalistButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'primary' | 'red' | 'blue' | 'whatsapp' | 'whiteRed' | 'spotify' | 'instagram' | 'soundcloud' | 'youtube';
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
    primary: "bg-white hover:bg-black hover:text-white brutalist-shadow",
    red: "bg-[#ff0000] text-white hover:bg-black brutalist-shadow-red hover:shadow-black",
    whiteRed: "bg-[#ffffff] text-black hover:bg-black brutalist-shadow-red hover:shadow-black",
    blue: "bg-[#0000ff] text-white hover:bg-black brutalist-shadow-blue hover:shadow-black",
    whatsapp: "bg-[#25D366] text-white hover:bg-black brutalist-shadow-green hover:shadow-black",
    spotify: "bg-[#1DB954] text-white hover:bg-black brutalist-shadow-spotify hover:shadow-black",
    instagram: "bg-gradient-to-r from-[#833AB4] via-[#E1306C] to-[#F77737] text-white hover:bg-black hover:bg-none brutalist-shadow-instagram hover:shadow-black",
    soundcloud: "bg-[#FF5500] text-white hover:bg-black brutalist-shadow-soundcloud hover:shadow-black",
    youtube: "bg-[#FF0000] text-white hover:bg-black brutalist-shadow-youtube hover:shadow-black",
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
