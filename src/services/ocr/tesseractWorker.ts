import { createWorker, type Worker } from 'tesseract.js';
import type { OcrResult, OcrLanguage, OcrLine, OcrWord, OcrBlock } from '../../types';
import { isArabicText } from '../export/docxExporter';

export interface OcrProgress {
  status: string;
  progress: number; // 0 to 1
}

export type OcrProgressCallback = (progress: OcrProgress) => void;

let activeWorker: Worker | null = null;
let currentLanguage: string | null = null;

export async function getTesseractWorker(
  lang: OcrLanguage = 'ara+eng',
  onProgress?: OcrProgressCallback
): Promise<Worker> {
  // If worker exists with same language, reuse it
  if (activeWorker && currentLanguage === lang) {
    return activeWorker;
  }

  // If language changed, terminate existing
  if (activeWorker) {
    try {
      await activeWorker.terminate();
    } catch (e) {
      console.warn('Error terminating previous worker:', e);
    }
    activeWorker = null;
  }

  const worker = await createWorker(lang, 1, {
    logger: (m) => {
      if (onProgress && typeof m.progress === 'number') {
        let statusText = m.status;
        if (m.status === 'loading tesseract core') statusText = 'تحميل محرك OCR... / Loading OCR engine...';
        else if (m.status === 'loading language traineddata') statusText = 'تحميل ملفات اللغة محلياً... / Loading language data...';
        else if (m.status === 'initializing api') statusText = 'تهيئة المعالج... / Initializing...';
        else if (m.status === 'recognizing text') statusText = 'قراءة وتحليل النص... / Recognizing text...';

        onProgress({
          status: statusText,
          progress: m.progress,
        });
      }
    },
  });

  activeWorker = worker;
  currentLanguage = lang;
  return worker;
}

export async function performOcr(
  imageSource: string | HTMLCanvasElement | Blob,
  lang: OcrLanguage = 'ara+eng',
  onProgress?: OcrProgressCallback
): Promise<OcrResult> {
  const worker = await getTesseractWorker(lang, onProgress);

  // Tune recognizer for Arabic: slower, more accurate page segmentation.
  // PSM 6 (single uniform block) keeps RTL lines intact; LSTM engine only.
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: '6' as any,
      preserve_interword_spaces: '1',
    });
  } catch {
    /* parameter tuning is best-effort */
  }

  const result = await worker.recognize(imageSource);

  const rawData = result.data as any;
  const rawLines: any[] = rawData.lines || [];

  // Compute average line height for heading detection
  let totalLineHeight = 0;
  let validLineCount = 0;

  for (const line of rawLines) {
    const h = line.bbox.y1 - line.bbox.y0;
    if (h > 5) {
      totalLineHeight += h;
      validLineCount++;
    }
  }
  const avgLineHeight = validLineCount > 0 ? totalLineHeight / validLineCount : 20;

  // Transform lines
  const lines: OcrLine[] = rawLines.map((line: any) => {
    const words: OcrWord[] = (line.words || []).map((w: any) => ({
      text: w.text.trim(),
      confidence: w.confidence,
      bbox: {
        x0: w.bbox.x0,
        y0: w.bbox.y0,
        x1: w.bbox.x1,
        y1: w.bbox.y1,
      },
    }));

    return {
      text: line.text.trim(),
      confidence: line.confidence,
      bbox: {
        x0: line.bbox.x0,
        y0: line.bbox.y0,
        x1: line.bbox.x1,
        y1: line.bbox.y1,
      },
      words,
    };
  });

  // Group lines into logical blocks / paragraphs
  const blocks: OcrBlock[] = [];
  const rawParagraphs: any[] = rawData.paragraphs || [];

  if (rawParagraphs.length > 0) {
    for (const p of rawParagraphs) {
      const pText = (p.text || '').trim();
      if (!pText) continue;

      const pLines: OcrLine[] = (p.lines || []).map((l: any) => ({
        text: l.text.trim(),
        confidence: l.confidence,
        bbox: {
          x0: l.bbox.x0,
          y0: l.bbox.y0,
          x1: l.bbox.x1,
          y1: l.bbox.y1,
        },
        words: (l.words || []).map((w: any) => ({
          text: w.text.trim(),
          confidence: w.confidence,
          bbox: {
            x0: w.bbox.x0,
            y0: w.bbox.y0,
            x1: w.bbox.x1,
            y1: w.bbox.y1,
          },
        })),
      }));

      const blockHeight = p.bbox.y1 - p.bbox.y0;
      // Heading detection heuristic: single-line block with height >= 1.3x average
      const isHeading = pLines.length === 1 && blockHeight >= avgLineHeight * 1.3;

      blocks.push({
        text: pText,
        bbox: {
          x0: p.bbox.x0,
          y0: p.bbox.y0,
          x1: p.bbox.x1,
          y1: p.bbox.y1,
        },
        lines: pLines,
        isHeading,
        isRtl: isArabicText(pText),
      });
    }
  } else {
    // Fallback: treat each line as a block
    for (const line of lines) {
      if (!line.text) continue;
      const lh = line.bbox.y1 - line.bbox.y0;
      blocks.push({
        text: line.text,
        bbox: line.bbox,
        lines: [line],
        isHeading: lh >= avgLineHeight * 1.3,
        isRtl: isArabicText(line.text),
      });
    }
  }

  // Get image dimensions if available
  let imgWidth = 800;
  let imgHeight = 600;
  if (typeof imageSource === 'string' && imageSource.startsWith('data:image')) {
    // Estimate or extract from bbox maximums
    for (const l of lines) {
      if (l.bbox.x1 > imgWidth) imgWidth = l.bbox.x1 + 50;
      if (l.bbox.y1 > imgHeight) imgHeight = l.bbox.y1 + 50;
    }
  }

  // Clean the raw text: fix common Arabic OCR artifacts and caller warnings
  const cleanedText = cleanOcrText(rawData.text || '');

  return {
    text: cleanedText.trim(),
    confidence: rawData.confidence,
    lines,
    blocks,
    imageWidth: imgWidth,
    imageHeight: imgHeight,
  };
}

/**
 * Post-processing for Arabic OCR output:
 * - Rejoin words broken by line-wrapping artifacts
 * - Strip stray Latin glyphs Tesseract emits between Arabic words
 * - Normalize whitespace around Arabic punctuation
 */
function cleanOcrText(text: string): string {
  let out = text;

  // Collapse repeated identical punctuation runs  (e.g. "....", "،،،")
  out = out.replace(/([.،؛:,!?])\1{2,}/g, '$1');

  // Remove standalone Latin noise characters between Arabic tokens
  // (keeps legit Latin words which have length > 1)
  out = out.replace(/(^|\s)[\|\^\[\]{}<>@#~`_](?=\s|$)/g, ' ');

  // Normalize spacing before/after Arabic punctuation
  out = out.replace(/\s+([،؛؟!.])/g, '$1');
  out = out.replace(/([،؛؟])(?=\S)/g, '$1 ');

  // Fix Arabic definite-article split artifact "ال ا" → "الا" when OCR split it
  out = out.replace(/(\S)\s+ال\s+/g, '$1 ال');

  // Collapse 3+ blank lines into one
  out = out.replace(/\n{3,}/g, '\n\n');

  return out;
}

export async function terminateOcrWorker(): Promise<void> {
  if (activeWorker) {
    try {
      await activeWorker.terminate();
    } catch (e) {
      console.warn('Error terminating OCR worker:', e);
    }
    activeWorker = null;
    currentLanguage = null;
  }
}
