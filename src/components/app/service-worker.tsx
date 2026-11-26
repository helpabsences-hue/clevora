"use client";

import { useEffect } from "react";

/** Registers the service worker (installable app, offline page). Production only. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // not critical: the app works without it
    });
  }, []);
  return null;
}
