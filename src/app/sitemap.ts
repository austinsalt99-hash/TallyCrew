import type { MetadataRoute } from "next";
import { headers } from "next/headers";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = (await headers()).get("host") ?? "";
  if (host !== "tallycrew.ca") return [];

  const base = "https://tallycrew.ca";
  const routes = ["", "/features", "/pricing", "/demo"];

  return routes.map((route) => ({
    url: `${base}${route}`,
    lastModified: new Date(),
  }));
}
