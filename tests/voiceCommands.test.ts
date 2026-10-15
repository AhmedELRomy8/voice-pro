import { describe, it, expect } from 'vitest';
import {
  parseVoiceCommand,
  normalizeArabic,
  normalizeEnglish,
  isDestructiveCommand,
} from '../src/services/speech/voiceCommands';

describe('Voice Commands & Phrase Matcher', () => {
  it('normalizes Arabic text by removing tashkeel and unifying letters', () => {
    const raw = 'احْفَظِ المَلَفَّ!';
    const norm = normalizeArabic(raw);
    expect(norm).toBe('احفظ الملف');

    const alefs = 'أَكْلٌ وَإِيمَانٌ وَآيَةٌ';
    expect(normalizeArabic(alefs)).toBe('اكل وايمان وايه');
  });

  it('normalizes English text by converting to lowercase and stripping punctuation', () => {
    expect(normalizeEnglish('Save the Document!!')).toBe('save the document');
  });

  it('matches Arabic deterministic commands correctly', () => {
    const match1 = parseVoiceCommand('احفظ الملف');
    expect(match1).not.toBeNull();
    expect(match1?.command).toBe('save');
    expect(match1?.language).toBe('ar');

    const match2 = parseVoiceCommand('ملف جديد');
    expect(match2?.command).toBe('new');

    const match3 = parseVoiceCommand('صدّر وورد');
    expect(match3?.command).toBe('export_word');

    const match4 = parseVoiceCommand('تصدير إكسل');
    expect(match4?.command).toBe('export_excel');

    const match5 = parseVoiceCommand('انسخ النص');
    expect(match5?.command).toBe('copy');

    const match6 = parseVoiceCommand('امسح النص');
    expect(match6?.command).toBe('clear');

    const match7 = parseVoiceCommand('تراجع');
    expect(match7?.command).toBe('undo');

    const match8 = parseVoiceCommand('إعادة');
    expect(match8?.command).toBe('redo');
  });

  it('matches English deterministic commands correctly', () => {
    expect(parseVoiceCommand('save document')?.command).toBe('save');
    expect(parseVoiceCommand('new document')?.command).toBe('new');
    expect(parseVoiceCommand('export word')?.command).toBe('export_word');
    expect(parseVoiceCommand('export excel')?.command).toBe('export_excel');
    expect(parseVoiceCommand('copy text')?.command).toBe('copy');
    expect(parseVoiceCommand('clear text')?.command).toBe('clear');
    expect(parseVoiceCommand('undo')?.command).toBe('undo');
    expect(parseVoiceCommand('redo')?.command).toBe('redo');
  });

  it('rejects ordinary conversational text without false positive triggers', () => {
    expect(parseVoiceCommand('اليوم ذهبت إلى العمل وكتبت تقريراً')).toBeNull();
    expect(parseVoiceCommand('Hello, how are you doing today?')).toBeNull();
    expect(parseVoiceCommand('')).toBeNull();
    expect(parseVoiceCommand('   ')).toBeNull();
  });

  it('flags destructive commands (e.g. clear) appropriately for confirmation', () => {
    expect(isDestructiveCommand('clear')).toBe(true);
    expect(isDestructiveCommand('save')).toBe(false);
    expect(isDestructiveCommand('copy')).toBe(false);
    expect(isDestructiveCommand('export_word')).toBe(false);
  });
});
