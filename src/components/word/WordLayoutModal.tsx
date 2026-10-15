import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileDown,
  Sparkles,
  Layout,
  AlignRight,
  AlignLeft,
  Image as ImageIcon,
  AlertCircle
} from 'lucide-react';
import { Modal } from '../layout/Modal';
import { useTranslation } from '../../i18n/useTranslation';
import { performOcr } from '../../services/ocr/tesseractWorker';
import { generateDocxBlob, downloadBlob } from '../../services/export/docxExporter';
import type { OcrResult, OcrBlock } from '../../types';

interface WordLayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyToDocument: (title: string, content: string, blocks?: OcrBlock[]) => void;
}

export const WordLayoutModal: React.FC<WordLayoutModalProps> = ({
  isOpen,
  onClose,
  onApplyToDocument,
}) => {
  const { t } = useTranslation();

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [mode, setMode] = useState<'textOnly' | 'recreateLayout'>('recreateLayout');
  const [embedOriginal, setEmbedOriginal] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [docTitle, setDocTitle] = useState<string>('مستند وورد مستخرج');
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('الملف ليس صورة / File is not an image');
      return;
    }
    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImageSrc(dataUrl);
      setOcrResult(null);
    };
    reader.readAsDataURL(file);
  };

  const handleProcessImage = async () => {
    if (!imageSrc) return;
    setIsProcessing(true);
    setErrorMessage(null);
    setProgressStatus(t.extracting);

    try {
      const result = await performOcr(imageSrc, 'ara+eng', (p) => {
        setProgressStatus(p.status);
      });
      setOcrResult(result);
    } catch (err: any) {
      setErrorMessage(err.message || 'فشل تحليل تخطيط الصورة');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportDocx = async () => {
    if (!ocrResult && !imageSrc) return;
    try {
      const blob = await generateDocxBlob({
        title: docTitle,
        content: ocrResult ? ocrResult.text : '',
        blocks: mode === 'recreateLayout' && ocrResult ? ocrResult.blocks : undefined,
        originalImageBase64: embedOriginal && imageSrc ? imageSrc : undefined,
        recreateLayout: mode === 'recreateLayout',
      });
      downloadBlob(blob, `${docTitle || 'document'}.docx`);
    } catch (err: any) {
      setErrorMessage(`فشل تصدير ملف Word: ${err.message}`);
    }
  };

  const handleApply = () => {
    if (ocrResult) {
      onApplyToDocument(docTitle, ocrResult.text, ocrResult.blocks);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.wordModalTitle}
      size="large"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            {t.cancel}
          </button>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {ocrResult && (
              <>
                <button className="btn btn-secondary" onClick={handleApply}>
                  {t.appendToEditor}
                </button>
                <button className="btn btn-primary" onClick={handleExportDocx}>
                  <FileDown size={16} />
                  <span>{t.exportToWordButton}</span>
                </button>
              </>
            )}
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Mode Selector */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div
            onClick={() => setMode('recreateLayout')}
            style={{
              padding: '1rem',
              border: `2px solid ${mode === 'recreateLayout' ? 'var(--primary)' : 'var(--border-light)'}`,
              borderRadius: 'var(--radius-md)',
              backgroundColor: mode === 'recreateLayout' ? 'var(--primary-light)' : 'var(--bg-card)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: mode === 'recreateLayout' ? 'var(--primary)' : 'inherit' }}>
              <Layout size={18} />
              <span>{t.modeRecreateLayout}</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              استخدام إحداثيات OCR لإعادة بناء العناوين، المحاذاة، وتباعد الفقرات.
            </p>
          </div>

          <div
            onClick={() => setMode('textOnly')}
            style={{
              padding: '1rem',
              border: `2px solid ${mode === 'textOnly' ? 'var(--primary)' : 'var(--border-light)'}`,
              borderRadius: 'var(--radius-md)',
              backgroundColor: mode === 'textOnly' ? 'var(--primary-light)' : 'var(--bg-card)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: mode === 'textOnly' ? 'var(--primary)' : 'inherit' }}>
              <AlignRight size={18} />
              <span>{t.modeTextOnly}</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              استخراج النصوص كفقرات متتالية مع دعم العربية RTL والإنجليزية LTR.
            </p>
          </div>
        </div>

        {/* Options */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '240px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>عنوان المستند:</label>
            <input
              type="text"
              className="search-input"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder="اسم الملف في وورد..."
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={embedOriginal}
              onChange={(e) => setEmbedOriginal(e.target.checked)}
            />
            <ImageIcon size={15} />
            <span>{t.embedOriginalImage}</span>
          </label>
        </div>

        {/* Upload or Preview */}
        {!imageSrc ? (
          <div
            className="dropzone"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
            }}
          >
            <UploadCloud size={44} style={{ color: 'var(--primary)' }} />
            <div>
              <p style={{ fontWeight: 600 }}>{t.dragDropImage}</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.supportedFormats}</p>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {!ocrResult ? (
              <div style={{ textAlign: 'center', padding: '1rem' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleProcessImage}
                  disabled={isProcessing}
                  style={{ padding: '0.75rem 2rem' }}
                >
                  <Sparkles size={16} />
                  <span>{isProcessing ? progressStatus : 'تحليل التخطيط واستخراج Word'}</span>
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{t.layoutPreview}:</h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    عدد الفقرات/الكتل المكتشفة: {ocrResult.blocks.length}
                  </span>
                </div>

                <div
                  style={{
                    maxHeight: '320px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.25rem',
                    backgroundColor: 'var(--bg-muted)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem',
                  }}
                >
                  {ocrResult.blocks.map((block, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '0.65rem 0.85rem',
                        backgroundColor: 'white',
                        border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius-sm)',
                        textAlign: block.isRtl ? 'right' : 'left',
                        direction: block.isRtl ? 'rtl' : 'ltr',
                      }}
                    >
                      {block.isHeading && (
                        <span
                          style={{
                            display: 'inline-block',
                            backgroundColor: 'var(--primary-light)',
                            color: 'var(--primary)',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            marginBottom: '0.35rem',
                          }}
                        >
                          عنوان / Heading
                        </span>
                      )}
                      <p style={{ fontWeight: block.isHeading ? 700 : 400, fontSize: block.isHeading ? '1.1rem' : '0.95rem' }}>
                        {block.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {errorMessage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)', fontSize: '0.85rem' }}>
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>
    </Modal>
  );
};
