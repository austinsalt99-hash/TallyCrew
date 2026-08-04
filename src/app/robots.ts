import type { MetadataRoute } from "next";
import { headers } from "next/headers";

// Single robots.txt for the whole deployment, host-aware: tallycrew.ca (the
// marketing site) should be indexed; every other host (app.tallycrew.ca,
// www.tallycrew.ca) is the authenticated product and shouldn't be.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host") ?? "";

  if (host === "tallycrew.ca") {
    return {
      rules: { userAgent: "*", allow: "/" },
      sitemap: "https://tallycrew.ca/sitemap.xml",
    };
  }

  return { rules: { userAgent: "*", disallow: "/" } };
}
