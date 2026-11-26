// Fails when a translation key exists in one language but not in the others.
import { readFileSync } from "node:fs";
const flat = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
const sets = Object.fromEntries(["fr", "ar", "en"].map((l) => [l, new Set(flat(JSON.parse(readFileSync(`messages/${l}.json`, "utf8"))))]));
let bad = false;
for (const l of ["ar", "en"]) {
  const missing = [...sets.fr].filter((k) => !sets[l].has(k));
  const extra = [...sets[l]].filter((k) => !sets.fr.has(k));
  if (missing.length || extra.length) {
    bad = true;
    console.error(`${l}: missing ${JSON.stringify(missing)} extra ${JSON.stringify(extra)}`);
  }
}
// Client components may only use the text groups sent to the browser.
import { readdirSync, statSync } from "node:fs";
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(`${d}/${f}`).isDirectory() ? walk(`${d}/${f}`) : [`${d}/${f}`]));
const allowed = new Set([...readFileSync("src/i18n/client-namespaces.ts", "utf8").matchAll(/^\s+"([a-zA-Z]+)",$/gm)].map((m) => m[1]));
for (const file of walk("src").filter((f) => /\.tsx?$/.test(f))) {
  const src = readFileSync(file, "utf8");
  if (!src.startsWith('"use client"')) continue;
  for (const m of src.matchAll(/useTranslations\("([^".]+)/g)) {
    if (!allowed.has(m[1])) {
      bad = true;
      console.error(`${file}: client component uses "${m[1]}", add it to src/i18n/client-namespaces.ts`);
    }
  }
}
console.log(bad ? "✖ translation problems" : `✔ ${sets.fr.size} keys in fr, ar and en; client text groups OK`);
process.exit(bad ? 1 : 0);
