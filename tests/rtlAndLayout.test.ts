import { describe, it, expect } from 'vitest';
import { isArabicText } from '../src/services/export/docxExporter';

describe('RTL and Text Direction Analysis', () => {
  it('identifies pure Arabic sentences as RTL', () => {
    expect(isArabicText('بسم الله الرحمن الرحيم')).toBe(true);
    expect(isArabicText('تقرير المبيعات للربع الثالث')).toBe(true);
  });

  it('identifies English sentences as non-Arabic (LTR)', () => {
    expect(isArabicText('Financial Report Q3 2026')).toBe(false);
    expect(isArabicText('Welcome to the document tools app.')).toBe(false);
  });

  it('identifies mixed Arabic and English documents as RTL if Arabic characters are present', () => {
    expect(isArabicText('تقرير مالي لمشروع Voice Pro 2026')).toBe(true);
    expect(isArabicText('DOCX ملف')).toBe(true);
  });

  it('handles numbers, symbols, and empty input gracefully', () => {
    expect(isArabicText('1234567890')).toBe(false);
    expect(isArabicText('$$$ ### @@@')).toBe(false);
    expect(isArabicText('')).toBe(false);
  });
});
