/** Only same-site paths like "/team" (never "//evil.com", "/\evil.com" or full URLs). */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}
