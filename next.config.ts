import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321");

const isDev = process.env.NODE_ENV !== "production";
// Error monitoring endpoint, allowed only when Sentry is configured.
const sentryOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_SENTRY_DSN ? new URL(process.env.NEXT_PUBLIC_SENTRY_DSN).origin : "";
  } catch {
    return "";
  }
})();

/**
 * Content-Security-Policy: only our own scripts, Supabase for data, files and
 * logos. Next.js needs inline scripts/styles for hydration and themes.
 * frame-ancestors 'none' blocks clickjacking.
 */
const csp = [
  "default-src 'self'",
  // 'wasm-unsafe-eval': the ID scan (Tesseract) compiles WebAssembly; it does not allow eval().
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseUrl.origin}`,
  // Inspection videos: private Supabase links, and blob: while a gallery video is made smaller
  `media-src 'self' blob: ${supabaseUrl.origin}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseUrl.origin}${sentryOrigin ? ` ${sentryOrigin}` : ""}${isDev ? " ws: http://localhost:*" : ""}`,
  "frame-src 'self' blob:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Only when the API itself is https (a local http Supabase would be broken by it)
  ...(isDev || supabaseUrl.protocol !== "https:" ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      // The service worker must always be fresh so updates reach installed apps.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
  },
  // Almost every Parcolia page depends on the logged-in user and the active
  // agency, so we use classic dynamic rendering instead of Cache Components.
  cacheComponents: false,
  images: {
    remotePatterns: [
      {
        protocol: supabaseUrl.protocol.replace(":", "") as "http" | "https",
        hostname: supabaseUrl.hostname,
        port: supabaseUrl.port,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const config = withNextIntl(nextConfig);

/**
 * Sentry releases + readable stack traces: only when SENTRY_AUTH_TOKEN, SENTRY_ORG
 * and SENTRY_PROJECT are set (Vercel production). The release is the git commit.
 */
const sentryBuild = Boolean(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT);
export default sentryBuild
  ? withSentryConfig(config, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: true,
      release: { name: process.env.VERCEL_GIT_COMMIT_SHA },
      sourcemaps: { deleteSourcemapsAfterUpload: true },
      telemetry: false,
    })
  : config;
