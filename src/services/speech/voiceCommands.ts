import type { VoiceCommandType, VoiceCommandMatch } from '../../types';

// Normalize Arabic text (remove diacritics, unify alefs, taa marbuta, etc.)
export function normalizeArabic(text: string): string {
  return text
    // Remove Arabic diacritics / tashkeel
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Normalize Alefs
    .replace(/[أإآ]/g, 'ا')
    // Normalize Taa Marbuta
    .replace(/ة/g, 'ه')
    // Normalize Yaa
    .replace(/ى/g, 'ي')
    // Remove punctuation
    .replace(/[.,/#!$%^&*;:{}=\-_`~()؟،]/g, '')
    // Collapse multiple whitespace
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function normalizeEnglish(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?!]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface CommandPattern {
  type: VoiceCommandType;
  arabicPhrases: string[];
  englishPhrases: string[];
}

const COMMAND_PATTERNS: CommandPattern[] = [
  {
    type: 'save',
    arabicPhrases: ['احفظ الملف', 'احفظ المستند', 'حفظ الملف', 'حفظ المستند', 'احفظ', 'حفظ'],
    englishPhrases: ['save document', 'save file', 'save the file', 'save', 'save doc'],
  },
  {
    type: 'new',
    arabicPhrases: ['ملف جديد', 'مستند جديد', 'انشئ ملف جديد', 'انشئ مستند جديد', 'جديد'],
    englishPhrases: ['new document', 'new file', 'create new document', 'new'],
  },
  {
    type: 'export_word',
    arabicPhrases: ['صدر وورد', 'صدر ملف وورد', 'تصدير وورد', 'تصدير ملف وورد', 'حفظ وورد', 'تحويل لوورد'],
    englishPhrases: ['export word', 'export to word', 'export docx', 'download word'],
  },
  {
    type: 'export_excel',
    arabicPhrases: ['صدر اكسل', 'صدر ملف اكسل', 'تصدير اكسل', 'تصدير ملف اكسل', 'حفظ اكسل', 'تحويل لاكسل'],
    englishPhrases: ['export excel', 'export to excel', 'export xlsx', 'download excel'],
  },
  {
    type: 'copy',
    arabicPhrases: ['انسخ النص', 'نسخ النص', 'انسخ المحتوى', 'نسخ الكل', 'انسخ'],
    englishPhrases: ['copy text', 'copy all', 'copy the text', 'copy to clipboard', 'copy'],
  },
  {
    type: 'clear',
    arabicPhrases: ['امسح النص', 'مسح النص', 'امسح الكل', 'مسح الكل', 'امسح المستند', 'احذف كل شيء'],
    englishPhrases: ['clear text', 'clear all', 'delete all text', 'erase text', 'clear document'],
  },
  {
    type: 'undo',
    arabicPhrases: ['تراجع', 'تراجع عن اخر خطوة', 'الرجوع للخلف'],
    englishPhrases: ['undo', 'undo last action'],
  },
  {
    type: 'redo',
    arabicPhrases: ['اعادة', 'اعادة الخطوة', 'تقدم للامام'],
    englishPhrases: ['redo', 'redo action'],
  },
];

export function parseVoiceCommand(rawTranscript: string): VoiceCommandMatch | null {
  if (!rawTranscript || !rawTranscript.trim()) return null;

  const normAr = normalizeArabic(rawTranscript);
  const normEn = normalizeEnglish(rawTranscript);

  for (const pattern of COMMAND_PATTERNS) {
    // Check Arabic phrases
    for (const phrase of pattern.arabicPhrases) {
      const normPhrase = normalizeArabic(phrase);
      if (normAr === normPhrase || normAr.startsWith(normPhrase) || normAr.endsWith(normPhrase)) {
        return {
          command: pattern.type,
          phrase,
          language: 'ar',
          confidence: normAr === normPhrase ? 1.0 : 0.85,
        };
      }
    }

    // Check English phrases
    for (const phrase of pattern.englishPhrases) {
      const normPhrase = normalizeEnglish(phrase);
      if (normEn === normPhrase || normEn.startsWith(normPhrase) || normEn.endsWith(normPhrase)) {
        return {
          command: pattern.type,
          phrase,
          language: 'en',
          confidence: normEn === normPhrase ? 1.0 : 0.85,
        };
      }
    }
  }

  return null;
}

export function isDestructiveCommand(cmd: VoiceCommandType): boolean {
  return cmd === 'clear';
}
