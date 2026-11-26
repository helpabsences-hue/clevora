"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { z } from "zod";
import { Toaster } from "@/components/ui/sonner";

// Our Content-Security-Policy forbids eval(): tell zod not to try its eval-based speed-up.
z.config({ jitless: true });

/**
 * next-themes puts a tiny <script> in the page so the right theme shows before React
 * loads (no white flash). It runs from the server HTML. In the browser React 19 warns
 * about a <script> inside a component, so there we mark it as data: same element, no warning.
 */
const themeScriptProps = typeof window === "undefined" ? { suppressHydrationWarning: true } : { type: "application/json", suppressHydrationWarning: true };

export function Providers({ children, dir }: { children: ReactNode; dir: "ltr" | "rtl" }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange scriptProps={themeScriptProps}>
      {children}
      <Toaster dir={dir} />
    </ThemeProvider>
  );
}
