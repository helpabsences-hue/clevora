"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

/** Applies the theme saved in the user's profile (Mon compte / Paramètres). */
export function ThemeSync({ theme }: { theme: "light" | "dark" | "system" }) {
  const { theme: current, setTheme } = useTheme();
  useEffect(() => {
    if (current && current !== theme) setTheme(theme);
    // only when the saved preference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
  return null;
}
