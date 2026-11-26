import type { ReactNode } from "react";
import "./globals.css";

// The <html> element is rendered by app/[locale]/layout.tsx (it needs the locale).
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
