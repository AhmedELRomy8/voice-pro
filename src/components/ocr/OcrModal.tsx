import React, { useState, useRef } from 'react';
import {
  Upload,
  FileDown,
  RotateCcw,
  RotateCw,
  Sparkles,
  AlertCircle,
  Copy,
  Check,
  X,
  FileText
} from 'lucide-react';
import { Modal } from '../layout/Modal';
import { useTranslation } from '../../i18n/useTranslation';
import { performOcr } from '../../services/ocr/tesseractWorker';
import { rotateImage, upscaleForOcr, enhanceImageContrast } from '../../services/ocr/imageUtils';
import { exportTextToTxt } from '../../services/export/txtExporter';
import { generateDocxBlob, downloadBlob } from '../../services/export/docxExporter';
import { isPdfFile, processPdfFile } from '../../services/pdf/pdfService';
import type { OcrResult, OcrLanguage } from '../../types';

interface OcrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAppendText: (text: string) => void;
  onReplaceText: (text: string) => void;
  onOcrFinished?: (result: OcrResult, imageBase64: string) => void;
  isPageView?: boolean;
}

export const OcrModal: React.FC<OcrModalProps> = ({
  isOpen,
  onClose,
  onAppendText,
  onReplaceText,
  onOcrFinished,
  isPageView = false,
}) => {
  const { t, lang } = useTranslation();
  const isRtl = lang === 'ar';

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [isPdf, setIsPdf] = useState<boolean>(false);
  const [ocrLanguage, setOcrLanguage] = useState<OcrLanguage>('ara+eng');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [extractedText, setExtractedText] = useState<string>('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedFileRef = useRef<File | null>(null);

  const handleFileSelect = async (file: File) => {
    setErrorMessage(null);
    setExtractedText('');
    setConfidence(null);
    selectedFileRef.current = file;
    setSelectedFileName(file.name);

    if (isPdfFile(file)) {
      setIsPdf(true);
      setIsProcessing(true);
      setProgressStatus(isRtl ? 'جارٍ فحص ملف الـ PDF...' : 'Reading PDF file...');
      try {
        const result = await processPdfFile(file, (msg, curr, tot) => {
          setProgressStatus(msg);
          setProgressPercent(Math.round((curr / (tot || 1)) * 100));
        });
        if (result.pages.length > 0 && result.pages[0].renderedImageUrl) {
          setImageSrc(result.pages[0].renderedImageUrl);
        }
        if (result.fullText.trim()) {
          setExtractedText(result.fullText.trim());
          setConfidence(98);
        }
      } catch (err: any) {
        setErrorMessage(`${isRtl ? 'تعذر قراءة ملف PDF' : 'Failed to read PDF'}: ${err.message || err}`);
      } finally {
        setIsProcessing(false);
      }
    } else if (file.type.startsWith('image/')) {
      setIsPdf(false);
      const reader = new FileReader();
      reader.onload = (e) => setImageSrc(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setErrorMessage(isRtl
        ? 'الملف غير مدعوم. يرجى اختيار صورة (PNG, JPG) أو ملف PDF.'
        : 'Unsupported file type. Please choose an image (PNG, JPG) or PDF.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
  };

  const handleRunOcr = async () => {
    if (!imageSrc && !selectedFileRef.current) return;
    setIsProcessing(true);
    setErrorMessage(null);
    setProgressPercent(0);

    try {
      if (isPdf && selectedFileRef.current) {
        setProgressStatus(isRtl ? 'جارٍ استخراج النصوص من صفحات الـ PDF...' : 'Extracting text from PDF pages...');
        const pdfResult = await processPdfFile(selectedFileRef.current, (msg, c, tot) => {
          setProgressStatus(msg);
          setProgressPercent(Math.round((c / (tot || 1)) * 50));
        });

        let fullOcrText = pdfResult.fullText;
        if (!fullOcrText.trim() && pdfResult.pages.length > 0) {
          const pageTexts: string[] = [];
          for (let i = 0; i < pdfResult.pages.length; i++) {
            const page = pdfResult.pages[i];
            if (page.renderedImageUrl) {
              setProgressStatus(isRtl
                ? `OCR للصفحة ${i + 1} من ${pdfResult.pages.length}...`
                : `OCR page ${i + 1} of ${pdfResult.pages.length}...`);
              const res = await performOcr(page.renderedImageUrl, ocrLanguage, (p) => {
                setProgressPercent(50 + Math.round((p.progress / pdfResult.pages.length) * 50));
              });
              if (res.text) pageTexts.push(`--- ${isRtl ? 'صفحة' : 'Page'} ${i + 1} ---\n` + res.text);
            }
          }
          fullOcrText = pageTexts.join('\n\n');
        }
        setExtractedText(fullOcrText);
        setConfidence(92);
      } else if (imageSrc) {
        setProgressStatus(isRtl ? 'جارٍ تحسين الصورة قبل القراءة...' : 'Enhancing image for better accuracy...');
        const upscaled = await upscaleForOcr(imageSrc);
        const enhanced = await enhanceImageContrast(upscaled);
        const result = await performOcr(enhanced, ocrLanguage, (p) => {
          setProgressStatus(p.status);
          setProgressPercent(Math.round(p.progress * 100));
        });
        setExtractedText(result.text);
        setConfidence(Math.round(result.confidence));
        if (onOcrFinished) onOcrFinished(result, imageSrc);
      }
    } catch (err: any) {
      setErrorMessage(err.message || (isRtl ? 'فشلت عملية استخراج النص' : 'Text extraction failed'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRotate = async (degrees: number) => {
    if (!imageSrc) return;
    try {
      const rotated = await rotateImage(imageSrc, degrees);
      setImageSrc(rotated);
    } catch (err) { console.error('Rotation error:', err); }
  };

  const handleCopy = () => {
    if (extractedText) {
      navigator.clipboard.writeText(extractedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExportDocx = async () => {
    if (!extractedText) return;
    const blob = await generateDocxBlob({
      title: selectedFileName || 'VoxNote Document',
      content: extractedText,
    });
    downloadBlob(blob, `${selectedFileName ? selectedFileName.replace(/\.[^/.]+$/, '') : 'document'}.docx`);
  };

  const handleAppend = () => {
    if (extractedText) { onAppendText(extractedText); onClose(); }
  };
  const handleReplace = () => {
    if (extractedText) { onReplaceText(extractedText); onClose(); }
  };

  const clearFile = () => {
    setImageSrc(null);
    setSelectedFileName('');
    setIsPdf(false);
    setExtractedText('');
    setErrorMessage(null);
    setConfidence(null);
    selectedFileRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const footerButtons = (
    <div className="vox-modal-footer-row">
      <div className="vox-modal-footer-left">
        {extractedText && (
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => exportTextToTxt(extractedText, 'voxnote.txt')}>
              <FileDown size={14} /><span>TXT</span>
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleExportDocx}>
              <FileDown size={14} /><span>Word</span>
            </button>
          </>
        )}
      </div>
      <div className="vox-modal-footer-right">
        <button className="btn btn-secondary" onClick={onClose}>{t.cancel}</button>
        {extractedText && (
          <>
            <button className="btn btn-secondary" onClick={handleReplace}>{t.replaceEditor}</button>
            <button className="btn btn-primary" onClick={handleAppend}>{t.appendToEditor}</button>
          </>
        )}
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
              title={isRtl ? 'إزالة الملف' : 'Remove file'}
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
            <button
              type="button"
              className="vox-choose-btn"
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            >
              {isRtl ? 'اختر ملفاً' : 'Choose File'}
            </button>
            <div className="vox-dropzone-formats">PNG, JPG, PDF</div>
          </>
        )}
      </div>

      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        {/* Language Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 160 }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {isRtl ? 'لغة النص:' : 'Language:'}
          </label>
          <select
            className="vox-select"
            value={ocrLanguage}
            onChange={(e) => setOcrLanguage(e.target.value as OcrLanguage)}
            style={{ flex: 1 }}
          >
            <option value="ara">{isRtl ? 'عربي فقط' : 'Arabic only'}</option>
            <option value="eng">{isRtl ? 'إنجليزي فقط' : 'English only'}</option>
            <option value="ara+eng">{isRtl ? 'عربي + إنجليزي' : 'Arabic + English'}</option>
          </select>
        </div>

        {/* Rotate buttons */}
        {imageSrc && !isPdf && (
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => handleRotate(-90)} title={isRtl ? 'تدوير يساراً' : 'Rotate Left'}>
              <RotateCcw size={14} />
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => handleRotate(90)} title={isRtl ? 'تدوير يميناً' : 'Rotate Right'}>
              <RotateCw size={14} />
            </button>
          </div>
        )}

        {/* Extract Button */}
        <button
          className="vox-btn-pill btn-extract"
          onClick={handleRunOcr}
          disabled={(!imageSrc && !selectedFileRef.current) || isProcessing}
          style={{ whiteSpace: 'nowrap' }}
        >
          <Sparkles size={15} />
          <span>
            {isProcessing
              ? (isRtl ? 'جارٍ الاستخراج...' : 'Extracting...')
              : (isRtl ? 'استخراج النص' : 'Extract Text')}
          </span>
        </button>
      </div>

      {/* Progress bar */}
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

      {/* Preview + Output side by side */}
      {(imageSrc || extractedText) && (
        <div style={{ display: 'grid', gridTemplateColumns: imageSrc && extractedText ? '1fr 1fr' : '1fr', gap: '1rem' }}>
          {imageSrc && (
            <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <div style={{ padding: '0.6rem 0.85rem', background: 'var(--bg-muted)', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>
                {isRtl ? 'معاينة الملف' : 'Preview'}
              </div>
              <img src={imageSrc} alt="Preview" style={{ width: '100%', maxHeight: 260, objectFit: 'contain', background: '#f8fafc', display: 'block' }} />
            </div>
          )}

          {extractedText && (
            <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.85rem', background: 'var(--bg-muted)', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>
                <span>
                  {isRtl
                    ? `النص المستخرج${confidence !== null ? ` — دقة ~${confidence}%` : ''}`
                    : `Extracted Text${confidence !== null ? ` — ~${confidence}% accuracy` : ''}`}
                </span>
                <button className="vox-tool-btn" onClick={handleCopy}>
                  {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                  <span>{copied ? (isRtl ? 'تم' : 'Copied') : (isRtl ? 'نسخ' : 'Copy')}</span>
                </button>
              </div>
              <textarea
                className="vox-transcription-textarea"
                rows={8}
                value={extractedText}
                onChange={(e) => setExtractedText(e.target.value)}
                dir={ocrLanguage.includes('ara') ? 'rtl' : 'ltr'}
                style={{ flex: 1, resize: 'vertical', borderRadius: 0, border: 'none', minHeight: 160 }}
              />
            </div>
          )}
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
              {isRtl ? 'استخراج النص (صور و PDF)' : 'Image & PDF to Text'}
            </h2>
            <p className="vox-page-view-sub">
              {isRtl ? 'ارفع صورة أو PDF واستخرج النصوص العربية والإنجليزية بدقة عالية' : 'Upload an image or PDF and extract text with high accuracy'}
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
    <Modal isOpen={isOpen} onClose={onClose} title={isRtl ? 'استخراج النص' : 'Image to Text'} size="large" footer={footerButtons}>
      {mainContent}
    </Modal>
  );
};
