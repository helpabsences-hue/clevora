"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

export function Toaster({ dir }: { dir: "ltr" | "rtl" }) {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      dir={dir}
      position="top-center"
      richColors
      closeButton
      toastOptions={{ classNames: { toast: "text-base" } }}
    />
  );
}
