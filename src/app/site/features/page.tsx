import { redirect } from "next/navigation";

// The features content that used to live here has moved to the homepage,
// right below "Why choose TallyCrew?" (src/app/site/page.tsx) — this page
// just forwards old links/bookmarks there instead of 404ing.
export default function FeaturesPage() {
  redirect("/#features");
}
