import { downloadBlob } from './docxExporter';

export function exportTextToTxt(text: string, filename = 'document.txt'): void {
  // Prepend UTF-8 BOM so Windows Notepad and other tools display Arabic text correctly
  const bom = '\uFEFF';
  const blob = new Blob([bom + text], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, filename);
}
