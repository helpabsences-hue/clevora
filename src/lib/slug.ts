/** URL slug for an agency, e.g. "Agence Atlas Cars" → "agence-atlas-cars". */
export function slugify(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  if (base.length >= 3) return base;
  return base ? `agence-${base}` : "agence";
}

/** Adds a short random suffix when the slug is already taken. */
export function withSuffix(slug: string, random: () => number = Math.random): string {
  const suffix = Math.floor(random() * 36 ** 4)
    .toString(36)
    .padStart(4, "0");
  return `${slug.slice(0, 54)}-${suffix}`;
}
