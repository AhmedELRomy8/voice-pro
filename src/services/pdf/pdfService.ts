import * as pdfjsLib from 'pdfjs-dist';

/**
 * Detects whether a string contains predominantly Arabic characters
 * (shared helper to avoid circular imports)
 */
function hasArabic(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

/**
 * Joins text items within a visual row in correct reading order.
 * For Arabic (or mixed) lines we sort by X descending (right → left)
 * so Arabic reads naturally, and add separators only when the item does
 * not already include a trailing space (Arabic PDFs usually encode
 * full words per item; inserting spaces between every piece breaks RTL).
 */
function joinRowItems(items: any[]): string {
  const isArabicRow = items.some((it) => hasArabic(it.str || ''));
  const sorted = [...items].sort((a, b) =>
    isArabicRow
      ? b.transform[4] - a.transform[4] // right → left for Arabic rows
      : a.transform[4] - b.transform[4] // left → right for Latin rows
  );

  let out = '';
  for (const item of sorted) {
    const piece = (item.str || '').trim();
    if (!piece) continue;
    if (!out) {
      out = piece;
      continue;
    }
    const needsSpace = isArabicRow
      ? !/\s$/.test(out) && !/^\s/.test(piece) && !hasArabic(piece) && !hasArabic(out)
      : !/\s$/.test(out) && !/^\s/.test(piece);
    out += (needsSpace ? ' ' : '') + piece;
  }
  return out.trim();
}
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { TableGrid, TableRow, TableCell } from '../../types';

// Configure the worker source using the local bundled worker URL
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface PdfPageResult {
  pageNumber: number;
  text: string;
  hasDigitalText: boolean;
  tableData?: TableGrid;
  renderedImageBlob?: Blob;
  renderedImageUrl?: string;
  width: number;
  height: number;
}

export interface PdfProcessResult {
  totalPages: number;
  fullText: string;
  pages: PdfPageResult[];
  detectedTables: TableGrid[];
}

/**
 * Checks if a given file or MIME type is a PDF
 */
export function isPdfFile(file: File | Blob | string): boolean {
  if (typeof file === 'string') {
    return file.toLowerCase().endsWith('.pdf') || file.startsWith('data:application/pdf');
  }
  const fileName = 'name' in file ? (file as File).name.toLowerCase() : '';
  return file.type === 'application/pdf' || fileName.endsWith('.pdf');
}

/**
 * Loads a PDF document from an ArrayBuffer or Blob
 */
export async function loadPdfDocument(fileOrBuffer: Blob | ArrayBuffer) {
  const arrayBuffer = fileOrBuffer instanceof Blob 
    ? await fileOrBuffer.arrayBuffer() 
    : fileOrBuffer;

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
    cMapPacked: true,
  });

  return await loadingTask.promise;
}

/**
 * Renders a specific page of a PDF onto a canvas and returns image Blob and dimensions
 */
export async function renderPdfPageToCanvas(
  pdfDoc: any,
  pageNumber: number,
  scale = 2.0
): Promise<{ canvas: HTMLCanvasElement; blob: Blob; url: string; width: number; height: number }> {
  const page = await pdfDoc.getPage(pageNumber);
  // Raise base resolution so Arabic glyphs stay crisp for OCR
  const effectiveScale = Math.max(scale, 2.0);
  const viewport = page.getViewport({ scale: effectiveScale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not create canvas context for PDF rendering');
  }

  await page.render({
    canvasContext: ctx,
    viewport: viewport,
  }).promise;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Failed to convert PDF canvas to image'));
    }, 'image/png');
  });

  const url = URL.createObjectURL(blob);

  return {
    canvas,
    blob,
    url,
    width: viewport.width,
    height: viewport.height,
  };
}

/**
 * Extracts digital text from a PDF page and attempts to identify structured table rows
 */
export async function extractTextAndTablesFromPage(
  pdfDoc: any,
  pageNumber: number
): Promise<{ text: string; hasDigitalText: boolean; table?: TableGrid }> {
  const page = await pdfDoc.getPage(pageNumber);
  const textContent = await page.getTextContent();
  const items = textContent.items as any[];

  if (!items || items.length === 0) {
    return { text: '', hasDigitalText: false };
  }

  // Filter items that actually contain printable characters
  const validItems = items.filter((item) => item.str && item.str.trim().length > 0);

  if (validItems.length === 0) {
    return { text: '', hasDigitalText: false };
  }

  // Group text items by their vertical Y-position (within a tolerance of 5px)
  const rowsMap = new Map<number, any[]>();
  for (const item of validItems) {
    const y = Math.round(item.transform[5]); // Y coordinate
    let matchedY: number | null = null;

    for (const existingY of rowsMap.keys()) {
      if (Math.abs(existingY - y) <= 6) {
        matchedY = existingY;
        break;
      }
    }

    if (matchedY !== null) {
      rowsMap.get(matchedY)!.push(item);
    } else {
      rowsMap.set(y, [item]);
    }
  }

  // Sort rows descending by Y (top of page to bottom)
  const sortedYKeys = Array.from(rowsMap.keys()).sort((a, b) => b - a);
  const lineStrings: string[] = [];
  const candidateTableRows: TableRow[] = [];

  let rowIdx = 0;
  for (const y of sortedYKeys) {
    const rowItems = rowsMap.get(y)!;

    // Width-aware tolerance grouping refinement: keep ordering deterministic
    const lineText = joinRowItems(rowItems);
    lineStrings.push(lineText);

    // If a line has multiple distinct horizontal segments separated by space, it might be a table row
    if (rowItems.length >= 2) {
      // Keep table cells in visual left→right order regardless of script
      const visualCells = [...rowItems].sort((a, b) => a.transform[4] - b.transform[4]);
      const cells: TableCell[] = visualCells.map((it, cellIdx) => ({
        id: `cell-${rowIdx}-${cellIdx}`,
        value: it.str.trim(),
      }));
      candidateTableRows.push({
        id: `row-${rowIdx}`,
        cells,
      });
    }
    rowIdx++;
  }

  const fullPageText = lineStrings.join('\n');
  let table: TableGrid | undefined = undefined;

  // If we found at least 2 structured rows with matching cell counts, treat as table
  if (candidateTableRows.length >= 2) {
    const firstCount = candidateTableRows[0].cells.length;
    const isConsistent = candidateTableRows.slice(0, 5).some((r) => Math.abs(r.cells.length - firstCount) <= 1);
    if (isConsistent) {
      table = {
        rows: candidateTableRows,
        headers: candidateTableRows[0].cells.map((c) => c.value),
        detectedConfidence: 0.9,
      };
    }
  }

  return {
    text: fullPageText,
    hasDigitalText: true,
    table,
  };
}

/**
 * Comprehensive PDF processor: extracts text, tables, and renders pages for OCR fallback
 */
export async function processPdfFile(
  file: File | Blob,
  onProgress?: (status: string, current: number, total: number) => void
): Promise<PdfProcessResult> {
  if (onProgress) onProgress('جارٍ فتح ملف PDF...', 0, 1);
  const pdfDoc = await loadPdfDocument(file);
  const totalPages = pdfDoc.numPages;

  const pages: PdfPageResult[] = [];
  const detectedTables: TableGrid[] = [];
  let combinedText = '';

  for (let i = 1; i <= totalPages; i++) {
    if (onProgress) onProgress(`معالجة الصفحة ${i} من ${totalPages}...`, i, totalPages);

    const { text, hasDigitalText, table } = await extractTextAndTablesFromPage(pdfDoc, i);
    let renderedBlob: Blob | undefined = undefined;
    let renderedUrl: string | undefined = undefined;
    let width = 800;
    let height = 1100;

    // Render page image (always render page 1 for preview; render others if no digital text)
    if (i === 1 || !hasDigitalText) {
      try {
        const rendered = await renderPdfPageToCanvas(pdfDoc, i, 1.5);
        renderedBlob = rendered.blob;
        renderedUrl = rendered.url;
        width = rendered.width;
        height = rendered.height;
      } catch (err) {
        console.warn(`Could not render PDF page ${i}:`, err);
      }
    }

    if (table) {
      detectedTables.push(table);
    }

    if (text) {
      combinedText += (combinedText ? '\n\n' : '') + `--- صفحة ${i} ---\n` + text;
    }

    pages.push({
      pageNumber: i,
      text,
      hasDigitalText,
      tableData: table,
      renderedImageBlob: renderedBlob,
      renderedImageUrl: renderedUrl,
      width,
      height,
    });
  }

  return {
    totalPages,
    fullText: combinedText,
    pages,
    detectedTables,
  };
}
