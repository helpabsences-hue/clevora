import { isHexColor } from "@/lib/brand";

/** Sets --brand / --brand-foreground for the active agency (values already contrast-checked). */
export function BrandStyle({ brand, foreground }: { brand: string; foreground: string }) {
  if (!isHexColor(brand) || !isHexColor(foreground)) return null;
  return <style>{`:root{--brand:${brand};--brand-foreground:${foreground};}`}</style>;
}
