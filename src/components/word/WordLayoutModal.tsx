import React, { useState, useRef } from 'react';
import { Upload, FileDown, Sparkles, AlertCircle, FileText, X } from 'lucide-react';
import { Modal } from '../layout/Modal';
import { useTranslation } from '../../i18n/useTranslation';
import { performOcr } from '../../services/ocr/tesseractWorker';
import { generateDocxBlob, downloadBlob } from '../../services/export/docxExporter';
import { isPdfFile, processPdfFile } from '../../services/pdf/pdfService';
import type { OcrResult, OcrBlock } from '../../types';

interface WordLayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyToDocument: (title: string, content: string, blocks?: OcrBlock[]) => void;
  isPageView?: boolean;
}

export const WordLayoutModal: React.FC<WordLayoutModalProps> = ({
  isOpen,
  onClose,
  onApplyToDocument,
  isPageView = false,
}) => {
  const { t, lang, isRtl } = useTranslation();

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [isPdf, setIsPdf] = useState<boolean>(false);
  const [ocrLanguage, setOcrLanguage] = useState<string>('ara+eng');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [docTitle, setDocTitle] = useState<string>('مستند VoxNote');
  const [extractedContent, setExtractedContent] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedFileRef = useRef<File | null>(null);

  const handleFileSelect = async (file: File) => {
    setErrorMessage(null);
    setExtractedContent('');
    selectedFileRef.current = file;
    setSelectedFileName(file.name);
    setDocTitle(file.name.replace(/\.[^/.]+$/, ''));

    if (isPdfFile(file)) {
      setIsPdf(true);
      setIsProcessing(true);
      setProgressStatus(isRtl ? 'جارٍ فحص ملف الـ PDF...' : 'Reading PDF...');
      try {
        const result = await processPdfFile(file, (msg, c, tot) => {
          setProgressStatus(msg);
          setProgressPercent(Math.round((c / (tot || 1)) * 100));
        });
        if (result.pages.length > 0 && result.pages[0].renderedImageUrl) {
          setImageSrc(result.pages[0].renderedImageUrl);
        }
        if (result.fullText.trim()) {
          setExtractedContent(result.fullText.trim());
        }
      } catch (err: any) {
        setErrorMessage(`${isRtl ? 'تعذر قراءة PDF' : 'Failed to read PDF'}: ${err.message || err}`);
      } finally {
        setIsProcessing(false);
        setProgressPercent(0);
      }
    } else if (file.type.startsWith('image/')) {
      setIsPdf(false);
      const reader = new FileReader();
      reader.onload = (e) => setImageSrc(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setErrorMessage(isRtl ? 'يرجى اختيار صورة صالحة أو ملف PDF.' : 'Please choose an image or PDF file.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
  };

  const clearFile = () => {
    setImageSrc(null);
    setSelectedFileName('');
    setIsPdf(false);
    setExtractedContent('');
    setErrorMessage(null);
    selectedFileRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleProcessAndGenerate = async () => {
    if (!imageSrc && !selectedFileRef.current) return;
    setIsProcessing(true);
    setErrorMessage(null);
    setProgressStatus(isRtl ? 'جارٍ تحويل المستند إلى Word...' : 'Converting to Word...');
    setProgressPercent(10);

    try {
      let content = extractedContent;
      let blocks: OcrBlock[] | undefined = undefined;

      if (isPdf && selectedFileRef.current) {
        const pdfRes = await processPdfFile(selectedFileRef.current, (msg, c, tot) => {
          setProgressStatus(msg);
          setProgressPercent(10 + Math.round((c / (tot || 1)) * 50));
        });
        content = pdfRes.fullText || content;

        if (!content.trim() && pdfRes.pages.length > 0) {
          const texts: string[] = [];
          for (let i = 0; i < pdfRes.pages.length; i++) {
            const page = pdfRes.pages[i];
            if (page.renderedImageUrl) {
              const ocr = await performOcr(page.renderedImageUrl, ocrLanguage as any, (p) => {
                setProgressPercent(60 + Math.round((p.progress / pdfRes.pages.length) * 30));
              });
              if (ocr.text) texts.push(`--- ${isRtl ? 'صفحة' : 'Page'} ${i + 1} ---\n` + ocr.text);
            }
          }
          content = texts.join('\n\n');
        }
      } else if (imageSrc) {
        const result = await performOcr(imageSrc, ocrLanguage as any, (p) => {
          setProgressStatus(p.status);
          setProgressPercent(10 + Math.round(p.progress * 70));
        });
        content = result.text;
        blocks = result.blocks;
      }

      setProgressStatus(isRtl ? 'جارٍ إنشاء ملف Word...' : 'Generating Word file...');
      setProgressPercent(90);

      const blob = await generateDocxBlob({
        title: docTitle,
        content,
        blocks,
      });

      downloadBlob(blob, `${docTitle}.docx`);
      onApplyToDocument(docTitle, content, blocks);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || (isRtl ? 'فشل تحويل المستند' : 'Document conversion failed'));
    } finally {
      setIsProcessing(false);
      setProgressPercent(0);
    }
  };

  const footerButtons = (
    <div className="vox-modal-footer-row">
      <div className="vox-modal-footer-left">
        <button className="btn btn-secondary" onClick={onClose}>{isRtl ? 'رجوع' : 'Back'}</button>
      </div>
      <div className="vox-modal-footer-right">
        <button
          className="btn btn-primary"
          onClick={handleProcessAndGenerate}
          disabled={(!imageSrc && !selectedFileRef.current) || isProcessing}
        >
          <FileDown size={16} />
          <span>
            {isProcessing
              ? (isRtl ? 'جارٍ التحويل...' : 'Converting...')
              : (isRtl ? 'تحويل وتنزيل Word' : 'Convert & Download Word')}
          </span>
        </button>
      </div>
    </div>
  );

  const mainContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Upload Zone */}
      <div
        className={`vox-dropzone ${isDragging ? 'dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="image/png,image/jpeg,image/webp,image/bmp,application/pdf"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        />
        {selectedFileName ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem' }}>
            <FileText size={28} color="var(--primary)" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedFileName}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>
                {isRtl ? 'تم تحميل الملف' : 'File loaded'}
              </div>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={(e) => { e.stopPropagation(); clearFile(); }}
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <>
            <div className="vox-dropzone-icon"><Upload size={28} /></div>
            <div className="vox-dropzone-title">
              {isRtl ? 'اسحب صورة أو PDF هنا' : 'Drag & drop image or PDF'}
            </div>
            <div className="vox-dropzone-or">{isRtl ? 'أو' : 'or'}</div>
            <button type="button" className="vox-choose-btn" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
              {isRtl ? 'اختر ملفاً' : 'Choose File'}
            </button>
            <div className="vox-dropzone-formats">PNG, JPG, PDF</div>
          </>
        )}
      </div>

      {/* Options row */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 160 }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {isRtl ? 'لغة النص:' : 'Language:'}
          </label>
          <select className="vox-select" value={ocrLanguage} onChange={(e) => setOcrLanguage(e.target.value)} style={{ flex: 1 }}>
            <option value="ara">{isRtl ? 'عربي فقط' : 'Arabic only'}</option>
            <option value="eng">{isRtl ? 'إنجليزي فقط' : 'English only'}</option>
            <option value="ara+eng">{isRtl ? 'عربي + إنجليزي' : 'Arabic + English'}</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 180 }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {isRtl ? 'اسم الملف:' : 'File name:'}
          </label>
          <input
            type="text"
            className="vox-text-input"
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>
      </div>

      {/* Preview */}
      {imageSrc && (
        <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <div style={{ padding: '0.6rem 0.85rem', background: 'var(--bg-muted)', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>
            {isRtl ? `معاينة: ${selectedFileName}` : `Preview: ${selectedFileName}`}
          </div>
          <img src={imageSrc} alt="Preview" style={{ width: '100%', maxHeight: 240, objectFit: 'contain', background: '#f8fafc', display: 'block' }} />
        </div>
      )}

      {/* Progress */}
      {isProcessing && (
        <div className="vox-progress-container">
          <div className="vox-progress-label">
            <span>{progressStatus}</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      )}

      {/* Error */}
      {errorMessage && (
        <div className="vox-error-box">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Extracted text preview */}
      {extractedContent && !isProcessing && (
        <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <div style={{ padding: '0.6rem 0.85rem', background: 'var(--bg-muted)', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>
            {isRtl ? 'محتوى مستخرج — سيتم تصديره داخل Word' : 'Extracted content — will be exported to Word'}
          </div>
          <textarea
            className="vox-transcription-textarea"
            rows={5}
            value={extractedContent}
            onChange={(e) => setExtractedContent(e.target.value)}
            dir={ocrLanguage.includes('ara') ? 'rtl' : 'ltr'}
            style={{ borderRadius: 0, border: 'none', width: '100%', resize: 'vertical' }}
          />
        </div>
      )}
    </div>
  );

  if (isPageView) {
    return (
      <div className="vox-page-view-card">
        <div className="vox-page-view-header">
          <div className="vox-page-view-title-wrap">
            <h2 className="vox-page-view-title">
              {isRtl ? 'تحويل الصور و PDF إلى Word' : 'Image & PDF to Word'}
            </h2>
            <p className="vox-page-view-sub">
              {isRtl ? 'رفع صورة أو PDF واستخراج النصوص العربية وتحويلها إلى ملف Word جاهز للتعديل' : 'Upload image or PDF and convert to editable Word document'}
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            {lang === 'ar' ? 'الرئيسية' : 'Home'}
          </button>
        </div>
        {mainContent}
        <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
          {footerButtons}
        </div>
      </div>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isRtl ? 'تحويل إلى Word' : 'Image to Word'} size="large" footer={footerButtons}>
      {mainContent}
    </Modal>
  );
};
