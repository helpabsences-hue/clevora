#!/usr/bin/env node
/**
 * Copies the OCR engine (Tesseract) to public/ocr so the ID scan works offline-first
 * and without any third-party CDN (our CSP only allows our own origin).
 * Run automatically before `dev` and `build`; public/ocr is not committed.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const out = join(process.cwd(), "public", "ocr");
mkdirSync(out, { recursive: true });
const tesseract = dirname(require.resolve("tesseract.js/package.json"));
const core = dirname(require.resolve("tesseract.js-core/package.json"));
const data = dirname(require.resolve("@tesseract.js-data/eng/package.json"));
const files = [
  [join(tesseract, "dist", "worker.min.js"), "worker.min.js"],
  // LSTM builds only (what "eng" 4.0 best_int needs); the worker picks SIMD when available
  ...["tesseract-core-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"].map((f) => [join(core, f), f]),
  [join(data, "4.0.0_best_int", "eng.traineddata.gz"), "eng.traineddata.gz"],
];
for (const [from, to] of files) {
  if (!existsSync(from)) {
    console.error(`copy-ocr: missing ${from}`);
    process.exit(1);
  }
  copyFileSync(from, join(out, to));
}
console.log(`copy-ocr: ${files.length} files in public/ocr`);
