import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: "https://www.drumandbasschile.cl/sitemap.xml", // ¡Usa tu dominio final aquí!
  };
}
