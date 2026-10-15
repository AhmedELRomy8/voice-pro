import type { TableGrid, TableRow, TableCell, OcrLine, OcrWord } from '../../types';
import { isArabicText } from '../export/docxExporter';

export interface TableDetectionResult {
  table: TableGrid;
  isReliable: boolean;
  message: string;
}

export function detectTableFromOcr(
  lines: OcrLine[],
  words: OcrWord[] = []
): TableDetectionResult {
  // If no words passed, extract from lines
  const allWords: OcrWord[] = words.length > 0
    ? words
    : lines.flatMap((l) => (l.words && l.words.length > 0 ? l.words : [{
        text: l.text,
        confidence: l.confidence,
        bbox: l.bbox,
      }]));

  // Filter out tiny noise
  const validWords = allWords.filter(
    (w) => w.text.trim().length > 0 && (w.bbox.x1 - w.bbox.x0) > 3 && (w.bbox.y1 - w.bbox.y0) > 3
  );

  if (validWords.length < 4) {
    return {
      table: { rows: [], detectedConfidence: 0 },
      isReliable: false,
      message: 'عدد الكلمات غير كافٍ لكشف جدول / Insufficient words for table detection',
    };
  }

  // 1. Group words into horizontal Rows based on Y-center and vertical overlap
  const sortedByY = [...validWords].sort((a, b) => {
    const yCenterA = (a.bbox.y0 + a.bbox.y1) / 2;
    const yCenterB = (b.bbox.y0 + b.bbox.y1) / 2;
    return yCenterA - yCenterB;
  });

  const rawRows: OcrWord[][] = [];

  for (const word of sortedByY) {
    const wordYCenter = (word.bbox.y0 + word.bbox.y1) / 2;

    // Find an existing row where this word fits vertically
    let matchedRow: OcrWord[] | null = null;
    for (const row of rawRows) {
      const rowYCenters = row.map((w) => (w.bbox.y0 + w.bbox.y1) / 2);
      const avgYCenter = rowYCenters.reduce((sum, v) => sum + v, 0) / row.length;
      const avgHeight = row.reduce((sum, w) => sum + (w.bbox.y1 - w.bbox.y0), 0) / row.length;

      const tolerance = Math.max(10, avgHeight * 0.55);
      if (Math.abs(wordYCenter - avgYCenter) <= tolerance) {
        matchedRow = row;
        break;
      }
    }

    if (matchedRow) {
      matchedRow.push(word);
    } else {
      rawRows.push([word]);
    }
  }

  if (rawRows.length < 2) {
    return {
      table: {
        rows: rawRows.map((r, i) => ({
          id: `r-${i}`,
          cells: [{ id: `c-${i}-0`, value: r.map((w) => w.text).join(' ') }],
        })),
        detectedConfidence: 20,
      },
      isReliable: false,
      message: 'عدد الصفوف المكتشفة أقل من 2 / Less than 2 rows detected',
    };
  }

  // Sort words inside each row by X coordinate
  for (const row of rawRows) {
    row.sort((a, b) => a.bbox.x0 - b.bbox.x0);
  }

  // Merge words in the same row that are separated by small horizontal spaces (word spaces <= 25px)
  // Into cohesive cell tokens
  const tokenRows: OcrWord[][] = rawRows.map((row) => {
    const tokens: OcrWord[] = [];
    let currentToken: OcrWord | null = null;

    for (const w of row) {
      if (!currentToken) {
        currentToken = { ...w, bbox: { ...w.bbox } };
      } else {
        const gap = w.bbox.x0 - currentToken.bbox.x1;
        // In a table, columns have significant spacing (> 25px). Ordinary words in a sentence have gap <= 25px.
        if (gap <= 25) {
          currentToken.text += ` ${w.text}`;
          currentToken.bbox.x1 = Math.max(currentToken.bbox.x1, w.bbox.x1);
          currentToken.bbox.y0 = Math.min(currentToken.bbox.y0, w.bbox.y0);
          currentToken.bbox.y1 = Math.max(currentToken.bbox.y1, w.bbox.y1);
        } else {
          tokens.push(currentToken);
          currentToken = { ...w, bbox: { ...w.bbox } };
        }
      }
    }
    if (currentToken) {
      tokens.push(currentToken);
    }
    return tokens;
  });

  // 2. Identify candidate Column Intervals across the token rows
  const xCenters: number[] = [];
  for (const row of tokenRows) {
    for (const token of row) {
      xCenters.push((token.bbox.x0 + token.bbox.x1) / 2);
    }
  }
  xCenters.sort((a, b) => a - b);

  // Cluster xCenters to find distinct vertical column bands
  const colCenters: number[] = [];
  const minColDistance = 45; // minimum pixel distance between distinct columns

  for (const x of xCenters) {
    let foundCol = false;
    for (let i = 0; i < colCenters.length; i++) {
      if (Math.abs(x - colCenters[i]) < minColDistance) {
        colCenters[i] = (colCenters[i] + x) / 2;
        foundCol = true;
        break;
      }
    }
    if (!foundCol) {
      colCenters.push(x);
    }
  }
  colCenters.sort((a, b) => a - b);

  const numCols = colCenters.length;

  // If only 1 column detected, this is ordinary paragraph prose
  if (numCols < 2) {
    return {
      table: {
        rows: rawRows.map((r, i) => ({
          id: `r-${i}`,
          cells: [{ id: `c-${i}-0`, value: r.map((w) => w.text).join(' ') }],
        })),
        detectedConfidence: 25,
      },
      isReliable: false,
      message: 'لم يتم كشف أعمدة متعددة (نص عادي) / Only 1 column detected (paragraph text)',
    };
  }

  // Calculate column boundaries (midpoints between centers)
  const boundaries: number[] = [0];
  for (let i = 0; i < numCols - 1; i++) {
    boundaries.push((colCenters[i] + colCenters[i + 1]) / 2);
  }
  boundaries.push(Infinity);

  // 3. Populate Table Rows and Cells
  const tableRows: TableRow[] = [];
  let multiCellRows = 0;

  for (let rIdx = 0; rIdx < tokenRows.length; rIdx++) {
    const rowTokens = tokenRows[rIdx];
    const cellBuckets: OcrWord[][] = Array.from({ length: numCols }, () => []);

    for (const token of rowTokens) {
      const tCenter = (token.bbox.x0 + token.bbox.x1) / 2;
      let assignedCol = numCols - 1;
      for (let cIdx = 0; cIdx < numCols; cIdx++) {
        if (tCenter >= boundaries[cIdx] && tCenter < boundaries[cIdx + 1]) {
          assignedCol = cIdx;
          break;
        }
      }
      cellBuckets[assignedCol].push(token);
    }

    let nonEmptyCount = 0;
    const cells: TableCell[] = cellBuckets.map((bucket, cIdx) => {
      bucket.sort((a, b) => a.bbox.x0 - b.bbox.x0);
      const text = bucket.map((w) => w.text).join(' ').trim();
      if (text) nonEmptyCount++;
      return {
        id: `c-${rIdx}-${cIdx}`,
        value: text,
      };
    });

    if (nonEmptyCount >= 2) {
      multiCellRows++;
    }

    tableRows.push({
      id: `r-${rIdx}`,
      cells,
    });
  }

  // 4. Calculate Reliability Confidence
  const multiCellRatio = multiCellRows / tokenRows.length;
  const confidence = Math.round(Math.min(100, Math.max(0, multiCellRatio * 100)));
  const isReliable = confidence >= 50 && numCols >= 2;

  // Check if table contains Arabic text to reverse columns for RTL
  let isTableArabic = false;
  for (const r of tableRows) {
    for (const c of r.cells) {
      if (isArabicText(c.value)) {
        isTableArabic = true;
        break;
      }
    }
    if (isTableArabic) break;
  }

  if (isTableArabic) {
    for (const r of tableRows) {
      r.cells.reverse();
    }
  }

  return {
    table: {
      rows: tableRows,
      detectedConfidence: confidence,
    },
    isReliable,
    message: isReliable
      ? `تم كشف جدول مكون من ${tableRows.length} صفوف و ${numCols} أعمدة بدقة ${confidence}%`
      : `دقة كشف الجدول منخفضة (${confidence}%). يبدو أن الصورة نص عادي وليس جدولاً مطبوعاً.`,
  };
}

// Table grid manipulation helpers
export function addRow(grid: TableGrid, atIndex?: number): TableGrid {
  const colCount = grid.rows[0]?.cells.length || 2;
  const newRowIndex = atIndex !== undefined ? atIndex : grid.rows.length;
  const newCells: TableCell[] = Array.from({ length: colCount }, (_, i) => ({
    id: `c-${Date.now()}-${i}`,
    value: '',
  }));

  const newRow: TableRow = {
    id: `r-${Date.now()}`,
    cells: newCells,
  };

  const updatedRows = [...grid.rows];
  updatedRows.splice(newRowIndex, 0, newRow);

  return {
    ...grid,
    rows: updatedRows,
  };
}

export function deleteRow(grid: TableGrid, index: number): TableGrid {
  if (grid.rows.length <= 1) return grid;
  const updatedRows = grid.rows.filter((_, idx) => idx !== index);
  return {
    ...grid,
    rows: updatedRows,
  };
}

export function addColumn(grid: TableGrid, atIndex?: number): TableGrid {
  const targetColIndex = atIndex !== undefined ? atIndex : (grid.rows[0]?.cells.length || 0);

  const updatedRows = grid.rows.map((row, rIdx) => {
    const updatedCells = [...row.cells];
    updatedCells.splice(targetColIndex, 0, {
      id: `c-${rIdx}-${Date.now()}`,
      value: '',
    });
    return { ...row, cells: updatedCells };
  });

  return {
    ...grid,
    rows: updatedRows,
  };
}

export function deleteColumn(grid: TableGrid, colIndex: number): TableGrid {
  const colCount = grid.rows[0]?.cells.length || 0;
  if (colCount <= 1) return grid;

  const updatedRows = grid.rows.map((row) => ({
    ...row,
    cells: row.cells.filter((_, idx) => idx !== colIndex),
  }));

  return {
    ...grid,
    rows: updatedRows,
  };
}

export function updateCellValue(
  grid: TableGrid,
  rowIndex: number,
  colIndex: number,
  value: string
): TableGrid {
  const updatedRows = grid.rows.map((row, rIdx) => {
    if (rIdx !== rowIndex) return row;
    const updatedCells = row.cells.map((cell, cIdx) => {
      if (cIdx !== colIndex) return cell;
      return { ...cell, value };
    });
    return { ...row, cells: updatedCells };
  });

  return {
    ...grid,
    rows: updatedRows,
  };
}
