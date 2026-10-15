import { describe, it, expect } from 'vitest';
import { generateDocxBlob } from '../src/services/export/docxExporter';
import { generateXlsxBlob, sanitizeCellValue } from '../src/services/export/xlsxExporter';
import type { TableGrid, OcrBlock } from '../src/types';

describe('Document Generation & Export Validity', () => {
  it('generates a valid DOCX Blob with paragraphs and headings', async () => {
    const blob = await generateDocxBlob({
      title: 'تقرير الأعمال / Business Report',
      content: 'هذا نص الفقرة الأولى بالعربية.\n\nThis is the second paragraph in English.',
    });

    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(1000); // Standard DOCX zip archive is > 1KB
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });

  it('generates a valid DOCX Blob in Mode B (recreate layout with OCR blocks)', async () => {
    const blocks: OcrBlock[] = [
      {
        text: 'العنوان الرئيسي للتقرير',
        bbox: { x0: 50, y0: 50, x1: 500, y1: 100 },
        lines: [],
        isHeading: true,
        isRtl: true,
      },
      {
        text: 'محتوى الفقرة المفصلة مع تنسيق المحاذاة والتباعد.',
        bbox: { x0: 50, y0: 120, x1: 500, y1: 200 },
        lines: [],
        isHeading: false,
        isRtl: true,
      },
    ];

    const blob = await generateDocxBlob({
      title: 'مستند مخصص',
      content: '',
      blocks,
      recreateLayout: true,
    });

    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(1000);
  });

  it('generates a valid XLSX Blob from TableGrid with Arabic RTL support', async () => {
    const table: TableGrid = {
      rows: [
        {
          id: 'r1',
          cells: [
            { id: 'c1', value: 'المنتج' },
            { id: 'c2', value: 'الكمية' },
            { id: 'c3', value: 'السعر' },
          ],
        },
        {
          id: 'r2',
          cells: [
            { id: 'c4', value: 'دفتر ملاحظات' },
            { id: 'c5', value: '5' },
            { id: 'c6', value: '25.50' },
          ],
        },
      ],
      detectedConfidence: 95,
    };

    const blob = generateXlsxBlob(table);

    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(1000);
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });

  it('sanitizes formula injection attempts in cell values without executing them', () => {
    expect(sanitizeCellValue('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
    expect(sanitizeCellValue('+cmd|"/C calc"!A0')).toBe("'+cmd|\"/C calc\"!A0");
    expect(sanitizeCellValue('-1+1')).toBe("'-1+1");
    expect(sanitizeCellValue('@HYPERLINK("evil.com")')).toBe("'@HYPERLINK(\"evil.com\")");
  });

  it('correctly handles numbers and preserves strings with leading zeroes', () => {
    // Pure integer
    expect(sanitizeCellValue('42')).toBe(42);
    // Decimal
    expect(sanitizeCellValue('3.1415')).toBe(3.1415);
    // Negative number
    expect(sanitizeCellValue('-150')).toBe(-150);
    // Code or phone number starting with zero: preserve as string!
    expect(sanitizeCellValue('00123')).toBe('00123');
    // Ordinary text
    expect(sanitizeCellValue('القاهرة')).toBe('القاهرة');
  });
});
