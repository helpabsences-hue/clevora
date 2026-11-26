/** Moroccan-first phone helpers. Stored format: E.164 (+212612345678). */

const MOROCCO = /^\+212[5-8]\d{8}$/;
const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * Normalises a phone number typed by a user.
 * "06 12 34 56 78", "0612-345678", "00212612345678", "212612345678" → "+212612345678".
 * Returns null when the number is not valid.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let v = input.replace(/[\s.\-()/]/g, "");
  if (v.startsWith("00")) v = `+${v.slice(2)}`;
  if (/^0[5-8]\d{8}$/.test(v)) v = `+212${v.slice(1)}`;
  if (/^212[5-8]\d{8}$/.test(v)) v = `+${v}`;
  if (v.startsWith("+212")) return MOROCCO.test(v) ? v : null;
  return E164.test(v) ? v : null;
}

/** "+212612345678" → "+212 6 12 34 56 78" (other countries are returned unchanged). */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const m = /^\+212(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(e164);
  return m ? `+212 ${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]}` : e164;
}

/** Digits only, for wa.me links. */
export function whatsappNumber(e164: string): string {
  return e164.replace(/\D/g, "");
}
