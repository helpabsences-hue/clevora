"use client";

import { parseMrz, type MrzResult } from "./mrz";

/**
 * Reads an ID photo IN THE BROWSER (Tesseract, files served from /ocr): the image
 * never leaves the phone. Tries the whole photo, then its lower half enlarged
 * (where the MRZ lines are), then the photo upside down.
 */
type Worker = Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>>;
let workerPromise: Promise<Worker> | null = null;

async function getWorker(onProgress?: (p: number) => void): Promise<Worker> {
  workerPromise ??= (async () => {
    const { createWorker } = await import("tesseract.js");
    const w = await createWorker("eng", 1, {
      workerPath: "/ocr/worker.min.js",
      corePath: "/ocr",
      langPath: "/ocr",
      gzip: true,
      workerBlobURL: false,
      logger: (m: { status: string; progress: number }) => {
        if (m.status === "recognizing text") onProgress?.(0.5 + m.progress / 2);
        else onProgress?.(Math.min(0.5, m.progress / 2));
      },
    });
    await w.setParameters({ tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<", tessedit_pageseg_mode: "6" as never });
    return w;
  })();
  try {
    return await workerPromise;
  } catch (e) {
    workerPromise = null;
    throw e;
  }
}

async function loadImage(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

/** Grey, contrasted, at a good size for OCR; optional crop (0..1 from the top) and rotation. */
function prepare(img: ImageBitmap, opts: { fromY?: number; rotate180?: boolean; width?: number } = {}): HTMLCanvasElement {
  const fromY = opts.fromY ?? 0;
  const sx = 0;
  const sy = Math.round(img.height * fromY);
  const sw = img.width;
  const sh = img.height - sy;
  const width = Math.min(opts.width ?? 1600, Math.max(sw, 1000));
  const height = Math.round((sh / sw) * width);
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  if (opts.rotate180) {
    ctx.translate(width, height);
    ctx.rotate(Math.PI);
  }
  ctx.filter = "grayscale(1) contrast(1.6)";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
  return c;
}

export async function scanIdDocument(file: Blob, onProgress?: (p: number) => void): Promise<MrzResult | null> {
  const worker = await getWorker(onProgress);
  const img = await loadImage(file);
  const attempts = [{}, { fromY: 0.45, width: 2000 }, { rotate180: true }, { rotate180: true, fromY: 0.45, width: 2000 }];
  let best: MrzResult | null = null;
  for (const a of attempts) {
    const { data } = await worker.recognize(prepare(img, a));
    const r = parseMrz(data.text);
    if (r?.valid) return r;
    if (r && !best) best = r;
  }
  img.close();
  return best;
}

/** Downloads the reader in the background (e.g. when the scan window opens). */
export function preloadScanner(): void {
  void getWorker().catch(() => undefined);
}
