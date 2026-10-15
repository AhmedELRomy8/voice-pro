import React, { useState, useEffect, useRef } from 'react';
import {
  Save,
  RotateCcw,
  RotateCw,
  Copy,
  Printer,
  FileDown,
  Trash2,
  Plus,
  AlignRight,
  AlignLeft,
  Check,
  Mic,
  Table as TableIcon
} from 'lucide-react';
import type { DocumentItem, TableGrid } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';
import { isArabicText, generateDocxBlob, downloadBlob } from '../../services/export/docxExporter';
import { generateXlsxBlob, exportTextLinesToXlsx } from '../../services/export/xlsxExporter';
import { exportTextToTxt } from '../../services/export/txtExporter';

interface DocumentEditorProps {
  currentDoc: DocumentItem;
  onSaveDoc: (doc: DocumentItem) => Promise<boolean>;
  onNewDoc: () => void;
  onTriggerSpeech: () => void;
  onOpenTableModal?: (table?: TableGrid) => void;
  onExecuteVoiceCommand?: (command: string) => void;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
  currentDoc,
  onSaveDoc,
  onNewDoc,
  onTriggerSpeech,
  onOpenTableModal,
}) => {
  const { t } = useTranslation();

  const [title, setTitle] = useState(currentDoc.title);
  const [content, setContent] = useState(currentDoc.content);
  const [isSaved, setIsSaved] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [direction, setDirection] = useState<'rtl' | 'ltr'>('rtl');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Undo / Redo history stacks
  const historyRef = useRef<string[]>([currentDoc.content]);
  const historyIndexRef = useRef<number>(0);

  // Update state when currentDoc changes externally
  useEffect(() => {
    setTitle(currentDoc.title);
    setContent(currentDoc.content);
    historyRef.current = [currentDoc.content];
    historyIndexRef.current = 0;
    setIsSaved(true);
    setDirection(isArabicText(currentDoc.content || currentDoc.title) ? 'rtl' : 'ltr');
  }, [currentDoc.id]);

  // Handle typing with history recording
  const handleContentChange = (newText: string) => {
    setContent(newText);
    setIsSaved(false);

    // Auto-detect direction if starts typing
    if (newText.length === 1) {
      setDirection(isArabicText(newText) ? 'rtl' : 'ltr');
    }

    // Push to undo stack (debounce or limit to 50 states)
    const currentHist = historyRef.current.slice(0, historyIndexRef.current + 1);
    currentHist.push(newText);
    if (currentHist.length > 50) currentHist.shift();
    historyRef.current = currentHist;
    historyIndexRef.current = currentHist.length - 1;
  };

  const handleUndo = () => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const prevText = historyRef.current[historyIndexRef.current];
      setContent(prevText);
      setIsSaved(false);
    }
  };

  const handleRedo = () => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      const nextText = historyRef.current[historyIndexRef.current];
      setContent(nextText);
      setIsSaved(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const updated: DocumentItem = {
      ...currentDoc,
      title: title.trim() || t.editorTitlePlaceholder,
      content,
      updatedAt: Date.now(),
    };
    const success = await onSaveDoc(updated);
    setIsSaving(false);
    if (success) {
      setIsSaved(true);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  };

  const handleClear = () => {
    setContent('');
    handleContentChange('');
    setShowClearConfirm(false);
  };

  const handleExportTxt = () => {
    exportTextToTxt(content, `${title || 'document'}.txt`);
  };

  const handleExportDocx = async () => {
    const blob = await generateDocxBlob({
      title: title || 'Document',
      content,
      tableData: currentDoc.tableData,
      originalImageBase64: currentDoc.originalImagePreview,
    });
    downloadBlob(blob, `${title || 'document'}.docx`);
  };

  const handleExportXlsx = () => {
    if (currentDoc.tableData && currentDoc.tableData.rows.length > 0) {
      const blob = generateXlsxBlob(currentDoc.tableData);
      downloadBlob(blob, `${title || 'table'}.xlsx`);
    } else {
      exportTextLinesToXlsx(content, `${title || 'document'}.xlsx`);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Stats
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  return (
    <div className="editor-container" role="region" aria-label="Document Editor">
      {/* Editor Toolbar */}
      <div className="editor-toolbar">
        <div className="toolbar-group">
          <button className="btn btn-secondary btn-sm" onClick={onNewDoc} title={t.newDocument}>
            <Plus size={15} />
            <span>{t.newDocument}</span>
          </button>

          <button
            className={`btn ${isSaved ? 'btn-secondary' : 'btn-primary'} btn-sm`}
            onClick={handleSave}
            disabled={isSaving}
            title={t.save}
          >
            <Save size={15} />
            <span>{isSaving ? t.saving : isSaved ? t.saved : t.save}</span>
          </button>

          <button
            className="btn btn-secondary btn-icon"
            onClick={handleUndo}
            disabled={historyIndexRef.current <= 0}
            title={t.undo}
          >
            <RotateCcw size={16} />
          </button>

          <button
            className="btn btn-secondary btn-icon"
            onClick={handleRedo}
            disabled={historyIndexRef.current >= historyRef.current.length - 1}
            title={t.redo}
          >
            <RotateCw size={16} />
          </button>
        </div>

        <div className="toolbar-group">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setDirection(direction === 'rtl' ? 'ltr' : 'rtl')}
            title={direction === 'rtl' ? t.ltr : t.rtl}
          >
            {direction === 'rtl' ? <AlignRight size={15} /> : <AlignLeft size={15} />}
            <span>{direction === 'rtl' ? 'عربي (RTL)' : 'English (LTR)'}</span>
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={handleCopy}
            title={t.copy}
          >
            {copied ? <Check size={15} style={{ color: 'var(--success)' }} /> : <Copy size={15} />}
            <span>{copied ? t.copied : t.copy}</span>
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={onTriggerSpeech}
            title={t.actionSpeechToText}
          >
            <Mic size={15} style={{ color: 'var(--primary)' }} />
            <span>{t.actionSpeechToText}</span>
          </button>

          {currentDoc.tableData && onOpenTableModal && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onOpenTableModal(currentDoc.tableData)}
              title={t.tablePreviewTitle}
            >
              <TableIcon size={15} style={{ color: 'var(--success)' }} />
              <span>{t.tablePreviewTitle}</span>
            </button>
          )}

          <div className="toolbar-group">
            <button className="btn btn-secondary btn-sm" onClick={handleExportTxt} title={t.exportTxt}>
              <FileDown size={14} />
              <span>TXT</span>
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleExportDocx} title={t.exportDocx}>
              <FileDown size={14} />
              <span>Word</span>
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleExportXlsx} title={t.exportXlsx}>
              <FileDown size={14} />
              <span>Excel</span>
            </button>
          </div>

          <button className="btn btn-secondary btn-icon" onClick={handlePrint} title={t.print}>
            <Printer size={16} />
          </button>

          <button
            className="btn btn-secondary btn-icon"
            style={{ color: 'var(--danger)' }}
            onClick={() => setShowClearConfirm(true)}
            title={t.clear}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Title Input */}
      <input
        type="text"
        className="editor-title-input"
        dir={direction}
        placeholder={t.editorTitlePlaceholder}
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setIsSaved(false);
        }}
      />

      {/* Main Textarea */}
      <textarea
        className="editor-textarea"
        dir={direction}
        placeholder={t.editorContentPlaceholder}
        value={content}
        onChange={(e) => handleContentChange(e.target.value)}
      />

      {/* Editor Footer with Stats */}
      <div className="editor-footer">
        <div>
          <span>{t.wordCount}: <strong>{wordCount}</strong></span>
          <span style={{ margin: '0 0.5rem' }}>•</span>
          <span>{t.charCount}: <strong>{charCount}</strong></span>
        </div>
        <div>
          <span>{direction === 'rtl' ? 'اتجاه النص: من اليمين لليسار' : 'Text: Left-to-Right'}</span>
        </div>
      </div>

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="modal-backdrop" onClick={() => setShowClearConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{t.clear}</h3>
            </div>
            <div className="modal-body">
              <p>{t.clearConfirm}</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowClearConfirm(false)}>
                {t.cancel}
              </button>
              <button className="btn btn-danger" onClick={handleClear}>
                {t.clear}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
