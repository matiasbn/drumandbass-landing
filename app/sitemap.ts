import { MetadataRoute } from "next";
import djsData from "@/app/dj/data.json";
import { getDjId } from "@/app/dj/utils";
import type { Dj } from "@/app/dj/types";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.drumandbasschile.cl"; // ¡Usa tu dominio final aquí!

  // Páginas estáticas
  const staticRoutes = ["/", "/dj", "/eventos", "/organizaciones"].map(
    (route) => ({
      url: `${baseUrl}${route}`,
      lastModified: new Date(),
    })
  );

  // Páginas dinámicas de DJs
  const djRoutes = (djsData as Dj[]).map((dj) => ({
    url: `${baseUrl}/dj/${getDjId(dj)}`,
    lastModified: new Date(),
  }));

  // Páginas dinámicas de sets de DJs
  const djSetsRoutes = (djsData as Dj[])
    .filter((dj) => dj.sets && dj.sets.length > 0)
    .map((dj) => ({
      url: `${baseUrl}/dj/${getDjId(dj)}/sets`,
      lastModified: new Date(),
    }));

  return [...staticRoutes, ...djRoutes, ...djSetsRoutes];
}
