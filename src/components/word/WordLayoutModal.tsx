import React, { useState, useRef } from 'react';
import {
  Upload,
  FileDown,
  Sparkles,
  Layout,
  FileText,
  AlertCircle,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
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
}

export const WordLayoutModal: React.FC<WordLayoutModalProps> = ({
  isOpen,
  onClose,
  onApplyToDocument,
}) => {
  const { t, isRtl } = useTranslation();
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [isPdf, setIsPdf] = useState<boolean>(false);
  const [tabMode, setTabMode] = useState<'extract' | 'layout'>('layout');
  const [ocrLanguage, setOcrLanguage] = useState<string>('ara+eng');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [docTitle, setDocTitle] = useState<string>('VoxNote Document');
  const [extractedContent, setExtractedContent] = useState<string>('');
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedFileRef = useRef<File | null>(null);

  const handleFileSelect = async (file: File) => {
    setErrorMessage(null);
    setOcrResult(null);
    setExtractedContent('');
    selectedFileRef.current = file;
    setSelectedFileName(file.name);
    setDocTitle(file.name.replace(/\.[^/.]+$/, ''));

    if (isPdfFile(file)) {
      setIsPdf(true);
      setIsProcessing(true);
      setProgressStatus('جارٍ فحص وتحليل ملف الـ PDF...');
      try {
        const result = await processPdfFile(file, (msg) => setProgressStatus(msg));
        if (result.pages.length > 0 && result.pages[0].renderedImageUrl) {
          setImageSrc(result.pages[0].renderedImageUrl);
        }
        if (result.fullText.trim()) {
          setExtractedContent(result.fullText.trim());
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
      setErrorMessage('يرجى اختيار صورة صالحة أو ملف PDF.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleProcessAndGenerate = async () => {
    if (!imageSrc && !selectedFileRef.current) return;
    setIsProcessing(true);
    setErrorMessage(null);
    setProgressStatus('جارٍ استخراج وتنسيق المستند...');

    try {
      let content = extractedContent;
      let blocks: OcrBlock[] | undefined = undefined;

      if (isPdf && selectedFileRef.current) {
        const pdfRes = await processPdfFile(selectedFileRef.current);
        content = pdfRes.fullText || content;

        // If digital text was empty, run OCR
        if (!content.trim() && pdfRes.pages.length > 0) {
          const texts: string[] = [];
          for (let i = 0; i < pdfRes.pages.length; i++) {
            const page = pdfRes.pages[i];
            if (page.renderedImageUrl) {
              const ocr = await performOcr(page.renderedImageUrl, ocrLanguage as any);
              if (ocr.text) texts.push(`--- صفحة ${i + 1} ---\n` + ocr.text);
            }
          }
          content = texts.join('\n\n');
        }
      } else if (imageSrc) {
        const result = await performOcr(imageSrc, ocrLanguage as any, (p) => {
          setProgressStatus(p.status);
        });
        setOcrResult(result);
        content = result.text;
        blocks = result.blocks;
      }

      setExtractedContent(content);

      // Generate DOCX blob
      const blob = await generateDocxBlob({
        title: docTitle,
        content: content,
        blocks: tabMode === 'layout' ? blocks : undefined,
      });

      downloadBlob(blob, `${docTitle}.docx`);

      onApplyToDocument(docTitle, content, blocks);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'فشل تحويل المستند إلى وورد');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Image to Word"
      size="large"
      footer={
        <div className="vox-modal-footer-row">
          <div className="vox-modal-footer-left">
            <button className="btn btn-secondary" onClick={onClose}>
              Back
            </button>
          </div>
          <div className="vox-modal-footer-right">
            <button
              className="btn btn-primary"
              onClick={handleProcessAndGenerate}
              disabled={(!imageSrc && !selectedFileRef.current) || isProcessing}
            >
              <FileDown size={16} />
              <span>{isProcessing ? 'Generating...' : 'Next / Export Word'}</span>
            </button>
          </div>
        </div>
      }
    >
      <div className="vox-screen-container">
        <p className="vox-screen-subtitle">Convert image or PDF to an editable Word document.</p>

        {/* Sub-Tabs: Extract Text | Recreate Layout */}
        <div className="vox-subtabs-row">
          <button
            className={`vox-subtab-btn ${tabMode === 'extract' ? 'active' : ''}`}
            onClick={() => setTabMode('extract')}
          >
            <FileText size={16} />
            <span>Extract Text</span>
          </button>
          <button
            className={`vox-subtab-btn ${tabMode === 'layout' ? 'active' : ''}`}
            onClick={() => setTabMode('layout')}
          >
            <Layout size={16} />
            <span>Recreate Layout</span>
          </button>
        </div>

        {/* Drag & Drop Box */}
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
              onChange={(e) => setOcrLanguage(e.target.value)}
            >
              <option value="ara">Arabic (Default) - العربية</option>
              <option value="eng">English - الإنجليزية</option>
              <option value="ara+eng">Arabic + English - عربي وإنجليزي</option>
            </select>
          </div>

          <div className="vox-lang-select-group">
            <label className="vox-label">Document Title</label>
            <input
              type="text"
              className="vox-text-input"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
            />
          </div>
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

        {isProcessing && (
          <div className="vox-progress-container">
            <div className="vox-progress-label">
              <span>{progressStatus}</span>
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: '85%' }} />
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="vox-error-box">
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>
    </Modal>
  );
};
