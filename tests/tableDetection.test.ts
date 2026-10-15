import { describe, it, expect } from 'vitest';
import {
  detectTableFromOcr,
  addRow,
  deleteRow,
  addColumn,
  deleteColumn,
  updateCellValue,
} from '../src/services/table/tableDetector';
import type { OcrWord, TableGrid } from '../src/types';

describe('Deterministic Geometric Table Detection', () => {
  it('detects a simple 3-row, 3-column table from OCR bounding boxes', () => {
    // Simulated table fixture:
    // Row 0 (Y: 50..70): [Item (X: 50..120), Quantity (X: 200..280), Price (X: 350..420)]
    // Row 1 (Y: 85..105): [Pen (X: 50..90), 10 (X: 200..230), 5.50 (X: 350..390)]
    // Row 2 (Y: 120..140): [Notebook (X: 50..130), 3 (X: 200..220), 15.00 (X: 350..400)]

    const words: OcrWord[] = [
      { text: 'Item', confidence: 95, bbox: { x0: 50, y0: 50, x1: 120, y1: 70 } },
      { text: 'Quantity', confidence: 92, bbox: { x0: 200, y0: 50, x1: 280, y1: 70 } },
      { text: 'Price', confidence: 90, bbox: { x0: 350, y0: 50, x1: 420, y1: 70 } },

      { text: 'Pen', confidence: 94, bbox: { x0: 50, y0: 85, x1: 90, y1: 105 } },
      { text: '10', confidence: 96, bbox: { x0: 200, y0: 85, x1: 230, y1: 105 } },
      { text: '5.50', confidence: 89, bbox: { x0: 350, y0: 85, x1: 390, y1: 105 } },

      { text: 'Notebook', confidence: 93, bbox: { x0: 50, y0: 120, x1: 130, y1: 140 } },
      { text: '3', confidence: 97, bbox: { x0: 200, y0: 120, x1: 220, y1: 140 } },
      { text: '15.00', confidence: 91, bbox: { x0: 350, y0: 120, x1: 400, y1: 140 } },
    ];

    const result = detectTableFromOcr([], words);

    expect(result.isReliable).toBe(true);
    expect(result.table.rows.length).toBe(3);
    expect(result.table.rows[0].cells.length).toBe(3);

    // Verify cell contents
    expect(result.table.rows[0].cells[0].value).toBe('Item');
    expect(result.table.rows[0].cells[1].value).toBe('Quantity');
    expect(result.table.rows[0].cells[2].value).toBe('Price');

    expect(result.table.rows[1].cells[0].value).toBe('Pen');
    expect(result.table.rows[1].cells[1].value).toBe('10');
    expect(result.table.rows[1].cells[2].value).toBe('5.50');
  });

  it('reports low confidence and isReliable=false for continuous ordinary paragraph text', () => {
    // Paragraph words in a single text flow column:
    const words: OcrWord[] = [
      { text: 'This', confidence: 95, bbox: { x0: 50, y0: 50, x1: 90, y1: 70 } },
      { text: 'is', confidence: 95, bbox: { x0: 95, y0: 50, x1: 110, y1: 70 } },
      { text: 'a', confidence: 95, bbox: { x0: 115, y0: 50, x1: 125, y1: 70 } },
      { text: 'regular', confidence: 95, bbox: { x0: 130, y0: 50, x1: 180, y1: 70 } },
      { text: 'paragraph', confidence: 95, bbox: { x0: 185, y0: 50, x1: 250, y1: 70 } },

      { text: 'without', confidence: 95, bbox: { x0: 50, y0: 75, x1: 110, y1: 95 } },
      { text: 'any', confidence: 95, bbox: { x0: 115, y0: 75, x1: 140, y1: 95 } },
      { text: 'tabular', confidence: 95, bbox: { x0: 145, y0: 75, x1: 195, y1: 95 } },
      { text: 'structure.', confidence: 95, bbox: { x0: 200, y0: 75, x1: 270, y1: 95 } },
    ];

    const result = detectTableFromOcr([], words);
    // Since columns overlap or form a single text block
    expect(result.table.detectedConfidence).toBeLessThan(50);
  });

  it('correctly adds and deletes rows in the table grid', () => {
    let grid: TableGrid = {
      rows: [
        { id: 'r1', cells: [{ id: 'c1', value: 'A' }, { id: 'c2', value: 'B' }] },
      ],
      detectedConfidence: 90,
    };

    grid = addRow(grid);
    expect(grid.rows.length).toBe(2);
    expect(grid.rows[1].cells.length).toBe(2);

    grid = deleteRow(grid, 0);
    expect(grid.rows.length).toBe(1);
  });

  it('correctly adds and deletes columns in the table grid', () => {
    let grid: TableGrid = {
      rows: [
        { id: 'r1', cells: [{ id: 'c1', value: 'A' }, { id: 'c2', value: 'B' }] },
        { id: 'r2', cells: [{ id: 'c3', value: '1' }, { id: 'c4', value: '2' }] },
      ],
      detectedConfidence: 90,
    };

    grid = addColumn(grid);
    expect(grid.rows[0].cells.length).toBe(3);
    expect(grid.rows[1].cells.length).toBe(3);

    grid = deleteColumn(grid, 1);
    expect(grid.rows[0].cells.length).toBe(2);
    expect(grid.rows[0].cells[0].value).toBe('A');
  });

  it('updates a specific cell value properly', () => {
    const grid: TableGrid = {
      rows: [
        { id: 'r1', cells: [{ id: 'c1', value: 'A' }, { id: 'c2', value: 'B' }] },
      ],
      detectedConfidence: 90,
    };

    const updated = updateCellValue(grid, 0, 1, 'Updated B');
    expect(updated.rows[0].cells[1].value).toBe('Updated B');
    expect(updated.rows[0].cells[0].value).toBe('A');
  });
});
