import { cn } from "@/lib/utils";

/** Agency logo, or its first letter on the brand colour when there is no logo. */
export function AgencyLogo({
  name,
  url,
  className,
  size = 40,
}: {
  name: string;
  url: string | null;
  className?: string;
  size?: number;
}) {
  const style = { width: size, height: size };
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- logos can be SVG; sizes are tiny
      <img src={url} alt="" style={style} className={cn("shrink-0 rounded-lg bg-white object-contain", className)} />
    );
  }
  return (
    <span
      aria-hidden
      style={style}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg bg-brand font-bold text-brand-foreground",
        className,
      )}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
