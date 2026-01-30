
import React from 'react';
import BigButton from './BigButton';

interface ProfileLink {
  title: string;
  url: string;
}

interface ProfileItem {
  title: string;
  url: string;
}

interface CardProps {
  name: string;
  links?: ProfileLink[];
  items?: ProfileItem[];
  itemsLabel?: string;
}

const Card: React.FC<CardProps> = ({ name, links, items, itemsLabel = "Sets" }) => {
  return (
    <div className="border-b-4 md:border-r-4 border-black p-8 hover:bg-gray-100 transition-colors flex flex-col justify-between group">
      <div>
        <h3 className="text-5xl font-black uppercase italic mb-6 group-hover:text-[#ff0000] transition-colors">
          {name}
        </h3>

        {links && links.length > 0 && (
          <div className="mb-8">
            <span className="mono text-xs font-black opacity-40 uppercase tracking-widest block mb-3">Links //</span>
            <div className="flex flex-col gap-2">
              {links.map((link, i) => (
                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="text-lg font-bold uppercase underline decoration-4 underline-offset-4 hover:text-[#0000ff]">
                  {link.title} →
                </a>
              ))}
            </div>
          </div>
        )}

        {items && items.length > 0 && (
          <div>
            <span className="mono text-xs font-black opacity-40 uppercase tracking-widest block mb-3">{itemsLabel} {'//'}</span>
            <ul className="space-y-4">
              {items.map((item, i) => (
                <li key={i}>
                  <BigButton
                    external
                    variant="whiteRed"
                    className="block border-2 border-black p-4 hover:shadow-none hover:bg-white hover:translate-x-1 hover:translate-y-1 transition-all"
                    href={item.url}
                  >
                    <span className="font-black uppercase text-lg">{item.title}</span>
                  </BigButton>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default Card;
