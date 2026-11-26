/**
 * MRZ (machine readable zone) of ID cards (TD1, 3 × 30: new Moroccan CIN back side)
 * and passports (TD3, 2 × 44). ICAO 9303: fixed positions + check digits, so a
 * reading is either verified or rejected. OCR mistakes (O/0, I/1, S/5, B/8…) are
 * fixed field by field, and accepted only when the check digit agrees.
 */
export type MrzResult = {
  format: "TD1" | "TD3";
  idType: "cin" | "passport";
  /** CIN number (AB123456) for Moroccan cards, passport number for passports. */
  idNumber: string;
  documentNumber: string;
  surname: string;
  givenNames: string;
  fullName: string;
  nationality: string; // ISO 3166 alpha-3, e.g. MAR
  birthDate: string | null; // yyyy-mm-dd
  expiryDate: string | null; // yyyy-mm-dd
  sex: "M" | "F" | null;
  /** All check digits verified. */
  valid: boolean;
};

const WEIGHTS = [7, 3, 1];
function charValue(c: string): number {
  if (c === "<") return 0;
  if (c >= "0" && c <= "9") return c.charCodeAt(0) - 48;
  return c.charCodeAt(0) - 55; // A=10
}
export function checkDigit(s: string): number {
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += charValue(s[i]) * WEIGHTS[i % 3];
  return sum % 10;
}

const TO_DIGIT: Record<string, string> = { O: "0", Q: "0", D: "0", I: "1", L: "1", Z: "2", S: "5", B: "8", G: "6", T: "7" };
const TO_LETTER: Record<string, string> = { "0": "O", "1": "I", "2": "Z", "5": "S", "8": "B", "6": "G" };
const digits = (s: string) => s.replace(/./g, (c) => TO_DIGIT[c] ?? c);
const letters = (s: string) => s.replace(/./g, (c) => TO_LETTER[c] ?? c);

/** A field and its check digit: return the field when they agree (after digit fixes if needed). */
function checked(field: string, check: string, numeric: boolean): { value: string; ok: boolean } {
  const cd = digits(check);
  const candidates = numeric ? [digits(field), field] : [field, digits(field)];
  for (const f of candidates) if (/^\d$/.test(cd) && checkDigit(f) === Number(cd)) return { value: f, ok: true };
  return { value: candidates[0], ok: false };
}

/** yymmdd -> yyyy-mm-dd. Birth dates are in the past; expiry dates may be in the future. */
function mrzDate(yymmdd: string, kind: "birth" | "expiry", now = new Date()): string | null {
  if (!/^\d{6}$/.test(yymmdd)) return null;
  const yy = Number(yymmdd.slice(0, 2));
  const mm = Number(yymmdd.slice(2, 4));
  const dd = Number(yymmdd.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const century = now.getUTCFullYear() % 100;
  const year = kind === "birth" ? (yy > century ? 1900 + yy : 2000 + yy) : yy >= 70 ? 1900 + yy : 2000 + yy;
  return `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function names(field: string): { surname: string; givenNames: string } {
  // Trailing "<<<<" are often read as K / L / C: drop that filler first.
  const clean = letters(field).replace(/[^A-Z<]/g, "<").replace(/<[<KLC]{2,}$/, "");
  const [surname = "", given = ""] = clean.split("<<");
  const tidy = (s: string) => s.replace(/<+/g, " ").trim();
  return { surname: tidy(surname), givenNames: tidy(given) };
}
const title = (s: string) => s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());

/** Moroccan CIN numbers: 1–2 letters then digits (A123456, AB123456). */
const CIN_RE = /[A-Z]{1,2}\d{4,7}/;

/** Normalise OCR text lines to MRZ characters and find the MRZ block. */
export function findMrzLines(text: string): { format: "TD1" | "TD3"; lines: string[] } | null {
  const raw = text
    .toUpperCase()
    .split(/\r?\n/)
    .map((l) => l.replace(/[«‹]/g, "<").replace(/\s+/g, "").replace(/[^A-Z0-9<]/g, ""))
    .filter((l) => l.length >= 25 && (l.match(/</g)?.length ?? 0) >= 2);
  // Passport: two lines of ~44
  for (let i = 0; i + 1 < raw.length; i++) {
    const a = raw[i];
    const b = raw[i + 1];
    if (a.length >= 40 && b.length >= 40 && a.startsWith("P")) return { format: "TD3", lines: [a.padEnd(44, "<").slice(0, 44), b.padEnd(44, "<").slice(0, 44)] };
  }
  // ID card: three lines of ~30, the first starting with I / A / C
  for (let i = 0; i + 2 < raw.length; i++) {
    const [a, b, c] = [raw[i], raw[i + 1], raw[i + 2]];
    if ([a, b, c].every((l) => l.length >= 26 && l.length <= 34) && /^[IAC]/.test(a)) {
      return { format: "TD1", lines: [a, b, c].map((l) => l.padEnd(30, "<").slice(0, 30)) };
    }
  }
  return null;
}

export function parseMrz(text: string, now = new Date()): MrzResult | null {
  const found = findMrzLines(text);
  if (!found) return null;
  if (found.format === "TD3") {
    const [l1, l2] = found.lines;
    const { surname, givenNames } = names(l1.slice(5));
    const doc = checked(l2.slice(0, 9), l2[9], false);
    const birth = checked(l2.slice(13, 19), l2[19], true);
    const expiry = checked(l2.slice(21, 27), l2[27], true);
    const nationality = letters(l2.slice(10, 13)).replace(/</g, "");
    const documentNumber = doc.value.replace(/</g, "");
    return {
      format: "TD3",
      idType: "passport",
      idNumber: documentNumber,
      documentNumber,
      surname,
      givenNames,
      fullName: [surname, title(givenNames)].filter(Boolean).join(" "),
      nationality,
      birthDate: mrzDate(birth.value, "birth", now),
      expiryDate: mrzDate(expiry.value, "expiry", now),
      sex: l2[20] === "M" || l2[20] === "F" ? l2[20] : null,
      valid: doc.ok && birth.ok && expiry.ok,
    };
  }
  const [l1, l2, l3] = found.lines;
  const doc = checked(l1.slice(5, 14), l1[14], false);
  const optional = l1.slice(15, 30).replace(/</g, "");
  const birth = checked(l2.slice(0, 6), l2[6], true);
  const expiry = checked(l2.slice(8, 14), l2[14], true);
  const nationality = letters(l2.slice(15, 18)).replace(/</g, "");
  const { surname, givenNames } = names(l3);
  const documentNumber = doc.value.replace(/</g, "");
  // Moroccan CIN: the national number (AB123456) is in the optional data.
  const cin = optional.match(CIN_RE)?.[0] ?? documentNumber.match(CIN_RE)?.[0] ?? null;
  return {
    format: "TD1",
    idType: "cin",
    idNumber: cin ?? documentNumber,
    documentNumber,
    surname,
    givenNames,
    fullName: [surname, title(givenNames)].filter(Boolean).join(" "),
    nationality,
    birthDate: mrzDate(birth.value, "birth", now),
    expiryDate: mrzDate(expiry.value, "expiry", now),
    sex: l2[7] === "M" || l2[7] === "F" ? l2[7] : null,
    valid: doc.ok && birth.ok && expiry.ok,
  };
}

const NATIONALITIES: Record<string, string> = {
  MAR: "Marocaine", FRA: "Française", ESP: "Espagnole", BEL: "Belge", NLD: "Néerlandaise", DEU: "Allemande", ITA: "Italienne",
  GBR: "Britannique", USA: "Américaine", CAN: "Canadienne", DZA: "Algérienne", TUN: "Tunisienne", SEN: "Sénégalaise", CHE: "Suisse",
};
/** ISO alpha-3 code -> nationality in French (the code itself when unknown). */
export function nationalityName(code: string): string {
  return NATIONALITIES[code] ?? code;
}
