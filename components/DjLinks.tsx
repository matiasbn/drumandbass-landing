"use client";

import { ButtonLink } from "@/components/ButtonLink";
import { event } from "@/lib/gtag";
import type { Dj } from "@/app/dj/types";
import { getDjId } from "@/app/dj/utils";

interface DjLinksProps {
  dj: Dj;
}

export function DjLinks({ dj }: DjLinksProps) {
  const handleLinkClick = (title: string, url: string) => {
    event("dj_link_click", {
      dj_name: dj.name,
      link_title: title,
      link_url: url,
    });
  };

  const handleSetsClick = () => {
    event("button_click", {
      button_name: `Ver Sets de ${dj.name}`,
    });
  };

  return (
    <div className="flex w-full max-w-xs flex-col gap-4">
      {dj.links.map((link) => (
        <ButtonLink
          key={link.url}
          href={link.url}
          isExternal
          onClick={() => handleLinkClick(link.title, link.url)}
        >
          {link.title}
        </ButtonLink>
      ))}
      {dj.sets.length > 0 && (
        <ButtonLink href={`/dj/${getDjId(dj)}/sets`} onClick={handleSetsClick}>
          Sets
        </ButtonLink>
      )}
    </div>
  );
}
