import { MetadataRoute } from 'next';
import { BASE_URL } from '@/src/constants';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['/', '/artistas', '/organizaciones', '/productores'].map(
    (route) => ({
      url: `${BASE_URL}${route}`,
      lastModified: new Date(),
    })
  );
}
