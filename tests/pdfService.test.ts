import { describe, it, expect } from 'vitest';
import { isPdfFile } from '../src/services/pdf/pdfService';

describe('PDF Service', () => {
  it('correctly identifies PDF files by extension and mime type', () => {
    expect(isPdfFile('document.pdf')).toBe(true);
    expect(isPdfFile('REPORT.PDF')).toBe(true);
    expect(isPdfFile('image.png')).toBe(false);

    const pdfBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    expect(isPdfFile(pdfBlob)).toBe(true);

    const textBlob = new Blob(['hello'], { type: 'text/plain' });
    expect(isPdfFile(textBlob)).toBe(false);
  });
});
