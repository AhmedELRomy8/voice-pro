import * as XLSX from 'xlsx';
import type { TableGrid } from '../../types';
import { isArabicText, downloadBlob } from './docxExporter';

// Clean cell value to avoid formula injection while preserving numbers
export function sanitizeCellValue(val: string): string | number {
  if (val === null || val === undefined) return '';
  const trimmed = String(val).trim();

  // First check if purely numeric (including integer, decimal, negative)
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    // Preserve leading zeros (e.g. phone numbers or IDs like '00123') as string
    if (trimmed.length > 1 && trimmed.startsWith('0') && !trimmed.startsWith('0.')) {
      return trimmed;
    }
    const num = Number(trimmed);
    if (!isNaN(num) && isFinite(num)) {
      return num;
    }
  }

  // If starts with formula trigger (=, +, -, @), prefix with single quote to preserve as literal string
  if (/^[=+\-@]/.test(trimmed)) {
    return `'${trimmed}`;
  }

  return trimmed;
}

export function generateXlsxBlob(table: TableGrid, sheetName = 'Sheet1'): Blob {
  // Check if any cell has Arabic text to set RTL sheet direction
  let hasArabic = false;
  const data: (string | number)[][] = [];

  for (const row of table.rows) {
    const rowValues: (string | number)[] = [];
    for (const cell of row.cells) {
      const sanitized = sanitizeCellValue(cell.value);
      rowValues.push(sanitized);
      if (typeof sanitized === 'string' && isArabicText(sanitized)) {
        hasArabic = true;
      }
    }
    data.push(rowValues);
  }

  // Create workbook and worksheet using standard SheetJS
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set RTL worksheet view for Arabic documents
  if (hasArabic) {
    ws['!views'] = [{ rightToLeft: true }];
  }

  // Auto-fit column widths based on contents
  const colWidths: { wch: number }[] = [];
  for (const row of data) {
    row.forEach((cellVal, colIdx) => {
      const len = String(cellVal).length;
      colWidths[colIdx] = {
        wch: Math.max(colWidths[colIdx]?.wch || 10, len + 3),
      };
    });
  }
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const wbout = XLSX.write(wb, {
    bookType: 'xlsx',
    type: 'array',
  });

  return new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function exportTextLinesToXlsx(text: string, filename = 'document.xlsx'): void {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows = lines.map((line, idx) => ({
    id: `row-${idx}`,
    cells: [{ id: `cell-${idx}-0`, value: line.trim() }],
  }));

  const table: TableGrid = {
    rows,
    detectedConfidence: 100,
  };

  const blob = generateXlsxBlob(table);
  downloadBlob(blob, filename);
}
