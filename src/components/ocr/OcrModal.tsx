import React, { useState, useRef } from 'react';
import {
  Upload,
  RotateCcw,
  RotateCw,
  Sparkles,
  FileDown,
  Copy,
  Check,
  AlertCircle,
  FileText,
  FileSpreadsheet
} from 'lucide-react';
import { Modal } from '../layout/Modal';
import { useTranslation } from '../../i18n/useTranslation';
import { performOcr } from '../../services/ocr/tesseractWorker';
import { rotateImage } from '../../services/ocr/imageUtils';
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
      setProgressStatus('جارٍ فحص وتحليل ملف الـ PDF...');
      try {
        const result = await processPdfFile(file, (msg, curr, tot) => {
          setProgressStatus(msg);
          setProgressPercent(Math.round((curr / (tot || 1)) * 100));
        });

        if (result.pages.length > 0 && result.pages[0].renderedImageUrl) {
          setImageSrc(result.pages[0].renderedImageUrl);
        }

        // If digital text was extracted directly from the PDF
        if (result.fullText.trim()) {
          setExtractedText(result.fullText.trim());
          setConfidence(98);
        }
      } catch (err: any) {
        setErrorMessage(`تعذر قراءة ملف PDF: ${err.message || err}`);
      } finally {
        setIsProcessing(false);
      }
    } else if (file.type.startsWith('image/')) {
      setIsPdf(false);
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setImageSrc(dataUrl);
      };
      reader.readAsDataURL(file);
    } else {
      setErrorMessage('الملف غير مدعوم. يرجى اختيار صورة (PNG, JPG) أو ملف PDF.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleRunOcr = async () => {
    if (!imageSrc && !selectedFileRef.current) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setProgressPercent(0);

    try {
      // If it's a PDF and text is already extracted, we're done; if user clicks extract again, run OCR on page canvas
      if (isPdf && selectedFileRef.current) {
        setProgressStatus('جارٍ استخراج النصوص من صفحات الـ PDF عبر OCR...');
        const pdfResult = await processPdfFile(selectedFileRef.current, (msg, c, t) => {
          setProgressStatus(msg);
          setProgressPercent(Math.round((c / (t || 1)) * 50));
        });

        let fullOcrText = pdfResult.fullText;

        // If digital text was empty or user wants deep OCR on images of pages
        if (!fullOcrText.trim() && pdfResult.pages.length > 0) {
          const pageTexts: string[] = [];
          for (let i = 0; i < pdfResult.pages.length; i++) {
            const page = pdfResult.pages[i];
            if (page.renderedImageUrl) {
              setProgressStatus(`OCR للصفحة ${i + 1} من ${pdfResult.pages.length}...`);
              const res = await performOcr(page.renderedImageUrl, ocrLanguage, (p) => {
                setProgressPercent(50 + Math.round((p.progress / pdfResult.pages.length) * 50));
              });
              if (res.text) pageTexts.push(`--- صفحة ${i + 1} ---\n` + res.text);
            }
          }
          fullOcrText = pageTexts.join('\n\n');
        }

        setExtractedText(fullOcrText);
        setConfidence(92);
      } else if (imageSrc) {
        setProgressStatus('جارٍ تحليل وقراءة الصورة محلياً...');
        const result = await performOcr(imageSrc, ocrLanguage, (p) => {
          setProgressStatus(p.status);
          setProgressPercent(Math.round(p.progress * 100));
        });

        setExtractedText(result.text);
        setConfidence(Math.round(result.confidence));

        if (onOcrFinished) {
          onOcrFinished(result, imageSrc);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'فشلت عملية استخراج النص');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRotate = async (degrees: number) => {
    if (!imageSrc) return;
    try {
      const rotated = await rotateImage(imageSrc, degrees);
      setImageSrc(rotated);
    } catch (err) {
      console.error('Rotation error:', err);
    }
  };

  const handleCopy = () => {
    if (extractedText) {
      navigator.clipboard.writeText(extractedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExportTxt = () => {
    if (extractedText) exportTextToTxt(extractedText, 'voxnote_extracted.txt');
  };

  const handleExportDocx = async () => {
    if (extractedText) {
      const blob = await generateDocxBlob({
        title: selectedFileName || 'VoxNote Extracted Document',
        content: extractedText,
      });
      downloadBlob(blob, `${selectedFileName ? selectedFileName.replace(/\.[^/.]+$/, '') : 'document'}.docx`);
    }
  };

  const handleAppend = () => {
    if (extractedText) {
      onAppendText(extractedText);
      onClose();
    }
  };

  const handleReplace = () => {
    if (extractedText) {
      onReplaceText(extractedText);
      onClose();
    }
  };

  const footerButtons = (
    <div className="vox-modal-footer-row">
      <div className="vox-modal-footer-left">
        {extractedText && (
          <>
            <button className="btn btn-secondary btn-sm" onClick={handleExportTxt}>
              <FileDown size={14} /><span>TXT</span>
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleExportDocx}>
              <FileDown size={14} /><span>DOCX</span>
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
    <div className="vox-screen-container">
      {!isPageView && <p className="vox-screen-subtitle">Upload an image or PDF and extract the text using OCR.</p>}

      {/* Drag & Drop Area matching Screen 2 */}
      <div
        className="vox-dropzone"
        onDragOver={(e) => e.preventDefault()}
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
        <div className="vox-dropzone-icon">
          <Upload size={32} />
        </div>
        <div className="vox-dropzone-title">Drag & drop an image or PDF here</div>
        <div className="vox-dropzone-or">or</div>
        <button
          type="button"
          className="vox-choose-btn"
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
        >
          Choose File
        </button>
        <div className="vox-dropzone-formats">
          Supported formats: PNG, JPG, JPEG, PDF
        </div>
      </div>

      {/* Options Row */}
      <div className="vox-options-bar">
        <div className="vox-lang-select-group">
          <label className="vox-label">Language</label>
          <select
            className="vox-select"
            value={ocrLanguage}
            onChange={(e) => setOcrLanguage(e.target.value as OcrLanguage)}
          >
            <option value="ara">Arabic (Default) - العربية</option>
            <option value="eng">English - الإنجليزية</option>
            <option value="ara+eng">Arabic + English - عربي وإنجليزي</option>
          </select>
        </div>

        {imageSrc && !isPdf && (
          <div className="vox-img-tools">
            <button className="btn btn-secondary btn-sm" onClick={() => handleRotate(-90)} title="Rotate Left">
              <RotateCcw size={14} />
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => handleRotate(90)} title="Rotate Right">
              <RotateCw size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Preview box */}
      {imageSrc && (
        <div className="vox-preview-card">
          <div className="vox-preview-header">
            <label className="vox-label">Preview: {selectedFileName}</label>
          </div>
          <div className="vox-preview-img-container">
            <img src={imageSrc} alt="Preview" className="vox-preview-img" />
          </div>
        </div>
      )}

      {/* Extract Button & Progress */}
      <div className="vox-action-center">
        <button
          className="vox-btn-pill btn-extract"
          onClick={handleRunOcr}
          disabled={(!imageSrc && !selectedFileRef.current) || isProcessing}
        >
          <Sparkles size={16} />
          <span>{isProcessing ? 'Extracting...' : 'Extract Text'}</span>
        </button>
      </div>

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

      {errorMessage && (
        <div className="vox-error-box">
          <AlertCircle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Extracted Output */}
      {extractedText && (
        <div className="vox-transcription-section">
          <div className="vox-transcription-header">
            <label className="vox-label">
              Extracted Text {confidence !== null && `(Accuracy ~${confidence}%)`}
            </label>
            <button className="vox-tool-btn" onClick={handleCopy}>
              {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <textarea
            className="vox-transcription-textarea"
            rows={6}
            value={extractedText}
            onChange={(e) => setExtractedText(e.target.value)}
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
            <h2 className="vox-page-view-title">Image to Text (OCR & PDF)</h2>
            <p className="vox-page-view-sub">Upload an image or PDF and extract the text using OCR.</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            {lang === 'ar' ? 'الرجوع للرئيسية' : 'Back to Home'}
          </button>
        </div>
        {mainContent}
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
          {footerButtons}
        </div>
      </div>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Image to Text"
      size="large"
      footer={footerButtons}
    >
      {mainContent}
    </Modal>
  );
};
