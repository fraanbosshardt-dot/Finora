import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";
  return ["/", "/calculadora-cuotas", "/calculadora-prestamos", "/privacidad", "/terminos"].map(
    (path) => ({
      url: `${site}${path}`,
      changeFrequency: "monthly",
      priority: path === "/" ? 1 : 0.6,
    }),
  );
}
