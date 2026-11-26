"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { updateThemeAction } from "@/app/[locale]/(app)/account/actions";
import { cn } from "@/lib/utils";

/**
 * Light / dark in one tap (moon in light mode, sun in dark mode). Saved in the
 * profile so every device follows; "Automatique" stays available in Mon compte.
 */
export function ModeToggle({ className, save = true }: { className?: string; save?: boolean }) {
  const t = useTranslations("account.preferences");
  const { resolvedTheme, setTheme } = useTheme();
  const toggle = () => {
    // Before hydration resolvedTheme is undefined: read the class on <html>.
    const dark = resolvedTheme ? resolvedTheme === "dark" : document.documentElement.classList.contains("dark");
    const next = dark ? "light" : "dark";
    setTheme(next);
    if (save) void updateThemeAction(next);
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t("toggle")}
      title={t("toggle")}
      className={cn(
        "relative inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      data-testid="mode-toggle"
    >
      <MoonIcon className="size-5 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" aria-hidden />
      <SunIcon className="absolute size-5 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" aria-hidden />
    </button>
  );
}
