import Image from "next/image";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { h: 28, icon: 28 },
  md: { h: 36, icon: 36 },
  lg: { h: 56, icon: 64 },
} as const;

/**
 * The Parcolia logo (Parcolia pages only: login, signup, public site, /platform).
 * Agencies never see it as their brand: their own logo is in the app header.
 * Files in public/brand: a lighter version is shown in dark mode so the blue stays readable.
 */
export function ParcoliaLogo({
  className,
  showWordmark = true,
  size = "md",
  priority = false,
}: {
  className?: string;
  showWordmark?: boolean;
  size?: keyof typeof SIZES;
  priority?: boolean;
}) {
  const s = SIZES[size];
  const [file, w, h] = showWordmark
    ? (["parcolia-logo-horizontal", Math.round((s.h * 691) / 160), s.h] as const)
    : (["parcolia-icon", s.icon, s.icon] as const);
  return (
    <span className={cn("inline-flex shrink-0 items-center", className)} dir="ltr">
      <Image src={`/brand/${file}.png`} alt="Parcolia" width={w} height={h} priority={priority} className="dark:hidden" style={{ width: w, height: h }} />
      <Image src={`/brand/${file}-dark.png`} alt="Parcolia" width={w} height={h} priority={priority} className="hidden dark:block" style={{ width: w, height: h }} />
    </span>
  );
}
