"use client";

import { ButtonLink } from "@/components/ButtonLink";
import { event } from "@/lib/gtag";

interface Set {
  title: string;
  url: string;
}

interface DjSetListProps {
  djName: string;
  sets: Set[];
}

export function DjSetList({ djName, sets }: DjSetListProps) {
  const handleSetClick = (setTitle: string, setUrl: string) => {
    event("set_link_click", {
      dj_name: djName,
      set_title: setTitle,
      set_url: setUrl,
    });
  };

  return (
    <div className="flex w-full max-w-xs flex-col gap-4">
      {sets.map((set) => (
        <ButtonLink
          key={set.url}
          href={set.url}
          isExternal
          onClick={() => handleSetClick(set.title, set.url)}
        >
          {set.title}
        </ButtonLink>
      ))}
    </div>
  );
}
