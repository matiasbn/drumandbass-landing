import React from 'react';

interface GridProps {
  children: React.ReactNode[];
  title: string;
  subtitle?: string | null;
  count: number;
  countLabel: string;
  bgColor?: string;
  badgeColor?: string;
}

const Grid: React.FC<GridProps> = ({ children, title, subtitle = '', count, countLabel, bgColor = 'bg-[#0000ff]', badgeColor = 'bg-black' }) => {
  return (
    <>
      <div className={`sticky top-0 z-40 border-b-4 border-black ${bgColor} text-white`}>
        <div className="p-6 md:p-10 lg:p-12">
          <h2 className="text-6xl md:text-7xl lg:text-9xl font-black uppercase italic tracking-tighter leading-none">
            {title}
          </h2>
          {subtitle && <h3 className={`mono font-bold text-xl uppercase  inline-block px-4 py-1`}>{subtitle}</h3>}
          <p className={`mono font-bold mt-4 text-xl uppercase ${badgeColor} inline-block px-4 py-1`}>
            {count} {countLabel} {'//'}
          </p>
        </div>
      </div>

      <div className="card grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </>
  );
};

export default Grid;
