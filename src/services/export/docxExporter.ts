import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ImageRun
} from 'docx';
import type { TableGrid, OcrBlock } from '../../types';

// Detect whether a string contains predominantly Arabic characters
export function isArabicText(text: string): boolean {
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return arabicRegex.test(text);
}

// Helper to convert base64 data URL to Uint8Array
export function base64ToUint8Array(base64: string): Uint8Array {
  const base64Clean = base64.replace(/^data:image\/\w+;base64,/, '');
  const binaryString = atob(base64Clean);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export interface DocxExportOptions {
  title: string;
  content: string;
  blocks?: OcrBlock[];
  tableData?: TableGrid;
  originalImageBase64?: string;
  recreateLayout?: boolean;
}

export async function generateDocxBlob(options: DocxExportOptions): Promise<Blob> {
  const children: (Paragraph | Table)[] = [];

  // 1. Add Document Title
  const isTitleArabic = isArabicText(options.title);
  children.push(
    new Paragraph({
      text: options.title,
      heading: HeadingLevel.TITLE,
      alignment: isTitleArabic ? AlignmentType.RIGHT : AlignmentType.LEFT,
      bidirectional: isTitleArabic,
      spacing: { after: 240 },
    })
  );

  // 2. Optional: Embed original image as visual reference
  if (options.originalImageBase64) {
    try {
      const imageBytes = base64ToUint8Array(options.originalImageBase64);
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: imageBytes,
              transformation: {
                width: 500,
                height: 300,
              },
              type: 'png',
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
        })
      );
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: '— مرجع بصري: الصورة الأصلية / Visual Reference: Original Image —',
              italics: true,
              size: 20,
              color: '666666',
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
        })
      );
    } catch (err) {
      console.warn('Failed to embed reference image in DOCX:', err);
    }
  }

  // 3. Handle Mode B: Layout Recreated from OCR Blocks if provided
  if (options.recreateLayout && options.blocks && options.blocks.length > 0) {
    for (const block of options.blocks) {
      const isRtl = block.isRtl ?? isArabicText(block.text);
      const isHeading = block.isHeading ?? false;

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: block.text,
              bold: isHeading,
              size: isHeading ? 28 : 24,
            }),
          ],
          heading: isHeading ? HeadingLevel.HEADING_1 : undefined,
          alignment: isRtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
          bidirectional: isRtl,
          spacing: {
            before: isHeading ? 200 : 100,
            after: isHeading ? 150 : 100,
          },
        })
      );
    }
  } else {
    // Mode A: Text paragraphs
    const paragraphs = options.content.split(/\r?\n\r?\n/);
    for (const p of paragraphs) {
      const trimmed = p.trim();
      if (!trimmed) continue;

      const isRtl = isArabicText(trimmed);
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: trimmed,
              size: 24,
            }),
          ],
          alignment: isRtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
          bidirectional: isRtl,
          spacing: { after: 160 },
        })
      );
    }
  }

  // 4. Optional: Embed table if present
  if (options.tableData && options.tableData.rows.length > 0) {
    const tableRows = options.tableData.rows.map((row, rowIndex) => {
      const cells = row.cells.map((cell) => {
        const isCellArabic = isArabicText(cell.value);
        return new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: cell.value || '',
                  bold: rowIndex === 0, // Header row bold
                  size: 22,
                }),
              ],
              alignment: isCellArabic ? AlignmentType.RIGHT : AlignmentType.LEFT,
              bidirectional: isCellArabic,
            }),
          ],
          width: {
            size: 100 / Math.max(1, row.cells.length),
            type: WidthType.PERCENTAGE,
          },
          shading: rowIndex === 0 ? { fill: 'F1F5F9' } : undefined,
        });
      });

      return new TableRow({
        children: cells,
      });
    });

    children.push(
      new Table({
        rows: tableRows,
        width: {
          size: 100,
          type: WidthType.PERCENTAGE,
        },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
          left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
          right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
        },
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
