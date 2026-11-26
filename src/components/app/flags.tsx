import { cn } from "@/lib/utils";

/**
 * Small flag images for the language menu (inline SVG: flag emojis do not show on
 * Windows). Decorative: the language name is always written next to them.
 */
export function Flag({ code, className }: { code: "fr" | "ar" | "en"; className?: string }) {
  const cls = cn("inline-block shrink-0 overflow-hidden rounded-full ring-1 ring-black/10 dark:ring-white/15", className);
  if (code === "fr")
    return (
      <svg viewBox="0 0 30 30" className={cls} aria-hidden>
        <rect width="10" height="30" fill="#0055A4" />
        <rect x="10" width="10" height="30" fill="#FFFFFF" />
        <rect x="20" width="10" height="30" fill="#EF4135" />
      </svg>
    );
  if (code === "ar")
    // Morocco: red field, green five-pointed star (outline)
    return (
      <svg viewBox="0 0 30 30" className={cls} aria-hidden>
        <rect width="30" height="30" fill="#C1272D" />
        <path
          d="M15 8.2 L17.05 14.5 L23.7 14.5 L18.33 18.4 L20.38 24.7 L15 20.8 L9.62 24.7 L11.67 18.4 L6.3 14.5 L12.95 14.5 Z"
          fill="none"
          stroke="#006233"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
    );
  // English: United States
  return (
    <svg viewBox="0 0 30 30" className={cls} aria-hidden>
      <rect width="30" height="30" fill="#FFFFFF" />
      {[0, 2, 4, 6, 8, 10, 12].map((i) => (
        <rect key={i} y={(i * 30) / 13} width="30" height={30 / 13} fill="#B22234" />
      ))}
      <rect width="15" height={(30 / 13) * 7} fill="#3C3B6E" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => <circle key={`${r}-${c}`} cx={3 + c * 4.5} cy={3 + r * 5} r="0.9" fill="#FFFFFF" />),
      )}
    </svg>
  );
}
