export type DocumentType = 'text' | 'word' | 'excel';

export interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface TableCell {
  id: string;
  value: string;
  colSpan?: number;
  rowSpan?: number;
}

export interface TableRow {
  id: string;
  cells: TableCell[];
}

export interface TableGrid {
  rows: TableRow[];
  headers?: string[];
  detectedConfidence: number;
}

export interface DocumentItem {
  id: string;
  title: string;
  content: string;
  type: DocumentType;
  createdAt: number;
  updatedAt: number;
  tableData?: TableGrid;
  originalImagePreview?: string;
}

export interface OcrWord {
  text: string;
  confidence: number;
  bbox: BoundingBox;
}

export interface OcrLine {
  text: string;
  confidence: number;
  bbox: BoundingBox;
  words: OcrWord[];
}

export interface OcrBlock {
  text: string;
  bbox: BoundingBox;
  lines: OcrLine[];
  isHeading?: boolean;
  isRtl?: boolean;
}

export interface OcrResult {
  text: string;
  confidence: number;
  lines: OcrLine[];
  blocks: OcrBlock[];
  imageWidth: number;
  imageHeight: number;
}

export type OcrLanguage = 'ara' | 'eng' | 'ara+eng';

export interface SpeechResult {
  text: string;
  language: string;
  durationSeconds: number;
}

export type VoiceCommandType = 
  | 'save' 
  | 'new' 
  | 'export_word' 
  | 'export_excel' 
  | 'copy' 
  | 'clear' 
  | 'undo' 
  | 'redo';

export interface VoiceCommandMatch {
  command: VoiceCommandType;
  phrase: string;
  language: 'ar' | 'en';
  confidence: number;
}

export interface AppSettings {
  uiLanguage: 'ar' | 'en';
  defaultOcrLanguage: OcrLanguage;
  speechLanguage: 'ar' | 'en' | 'auto';
  whisperModel: 'whisper-tiny' | 'whisper-base';
  embedOriginalImageInWord: boolean;
}

export interface ModelStatus {
  whisperDownloaded: boolean;
  whisperModelSizeMB: number;
  tesseractAraDownloaded: boolean;
  tesseractEngDownloaded: boolean;
}
