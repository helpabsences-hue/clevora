import { publicEnv } from "@/lib/env";

/** Public URL of an agency logo stored in the agency-logos bucket. */
export function logoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/agency-logos/${encoded}`;
}

export const LOGO_MAX_BYTES = 1024 * 1024;
export const LOGO_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/webp": "webp",
} as const;
export type LogoType = keyof typeof LOGO_TYPES;
