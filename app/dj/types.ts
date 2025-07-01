export interface LinkItem {
  title: string;
  url: string;
}

export type Set = LinkItem;

export interface Dj {
  name: string;
  links: LinkItem[];
  sets: Set[];
}
