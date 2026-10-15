import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  RotateCcw,
  RotateCw,
  Crop,
  Sparkles,
  FileDown,
  Copy,
  Check,
  AlertCircle,
  Maximize2
} from 'lucide-react';
import { Modal } from '../layout/Modal';
import { useTranslation } from '../../i18n/useTranslation';
import { performOcr, type OcrProgress } from '../../services/ocr/tesseractWorker';
import { rotateImage, cropImage, enhanceImageContrast, type CropRect } from '../../services/ocr/imageUtils';
import { exportTextToTxt } from '../../services/export/txtExporter';
import { generateDocxBlob, downloadBlob } from '../../services/export/docxExporter';
import type { OcrResult, OcrLanguage } from '../../types';

interface OcrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAppendText: (text: string) => void;
  onReplaceText: (text: string) => void;
  onOcrFinished?: (result: OcrResult, imageBase64: string) => void;
}

export const OcrModal: React.FC<OcrModalProps> = ({
  isOpen,
  onClose,
  onAppendText,
  onReplaceText,
  onOcrFinished,
}) => {
  const { t } = useTranslation();

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [ocrLanguage, setOcrLanguage] = useState<OcrLanguage>('ara+eng');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [extractedText, setExtractedText] = useState<string>('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Crop mode state
  const [isCropping, setIsCropping] = useState<boolean>(false);
  const [cropBox, setCropBox] = useState<CropRect>({ x: 50, y: 50, width: 250, height: 180 });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imagePreviewRef = useRef<HTMLImageElement | null>(null);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('الملف المحدد ليس صورة صالحة / Selected file is not an image');
      return;
    }
    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImageSrc(dataUrl);
      setOriginalImage(dataUrl);
      setExtractedText('');
      setConfidence(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleRotate = async (degrees: number) => {
    if (!imageSrc) return;
    try {
      const rotated = await rotateImage(imageSrc, degrees);
      setImageSrc(rotated);
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  const handleEnhance = async () => {
    if (!imageSrc) return;
    try {
      const enhanced = await enhanceImageContrast(imageSrc);
      setImageSrc(enhanced);
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  const handleApplyCrop = async () => {
    if (!imageSrc || !imagePreviewRef.current) return;
    try {
      // Calculate ratio between natural and rendered image dimensions
      const img = imagePreviewRef.current;
      const scaleX = img.naturalWidth / img.clientWidth;
      const scaleY = img.naturalHeight / img.clientHeight;

      const scaledCrop: CropRect = {
        x: Math.round(cropBox.x * scaleX),
        y: Math.round(cropBox.y * scaleY),
        width: Math.round(cropBox.width * scaleX),
        height: Math.round(cropBox.height * scaleY),
      };

      const cropped = await cropImage(imageSrc, scaledCrop);
      setImageSrc(cropped);
      setIsCropping(false);
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  const handleResetImage = () => {
    if (originalImage) {
      setImageSrc(originalImage);
      setIsCropping(false);
    }
  };

  const handleRunOcr = async () => {
    if (!imageSrc) return;
    setIsProcessing(true);
    setErrorMessage(null);
    setProgressStatus(t.extracting);
    setProgressPercent(0);

    try {
      const result = await performOcr(imageSrc, ocrLanguage, (p: OcrProgress) => {
        setProgressStatus(p.status);
        setProgressPercent(Math.round(p.progress * 100));
      });

      setExtractedText(result.text);
      setConfidence(Math.round(result.confidence));

      if (onOcrFinished) {
        onOcrFinished(result, imageSrc);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'فشل استخراج النص من الصورة');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = async () => {
    if (!extractedText) return;
    await navigator.clipboard.writeText(extractedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportTxt = () => {
    exportTextToTxt(extractedText, 'ocr-result.txt');
  };

  const handleExportDocx = async () => {
    const blob = await generateDocxBlob({
      title: 'OCR Extracted Text',
      content: extractedText,
      originalImageBase64: imageSrc || undefined,
    });
    downloadBlob(blob, 'ocr-result.docx');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.ocrModalTitle}
      size="large"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {extractedText && (
              <>
                <button className="btn btn-secondary btn-sm" onClick={handleExportTxt}>
                  <FileDown size={14} />
                  <span>TXT</span>
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleExportDocx}>
                  <FileDown size={14} />
                  <span>Word</span>
                </button>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-secondary" onClick={onClose}>
              {t.cancel}
            </button>
            {extractedText && (
              <>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    onReplaceText(extractedText);
                    onClose();
                  }}
                >
                  {t.replaceEditor}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    onAppendText(extractedText);
                    onClose();
                  }}
                >
                  {t.appendToEditor}
                </button>
              </>
            )}
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Controls row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t.documentLanguage}:</label>
            <select
              className="search-input"
              style={{ width: 'auto', padding: '0.35rem 0.75rem' }}
              value={ocrLanguage}
              onChange={(e) => setOcrLanguage(e.target.value as OcrLanguage)}
            >
              <option value="ara+eng">{t.arabicAndEnglish}</option>
              <option value="ara">{t.arabic}</option>
              <option value="eng">{t.english}</option>
            </select>
          </div>

          {imageSrc && (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => handleRotate(-90)} title={t.rotateLeft}>
                <RotateCcw size={14} />
                <span>{t.rotateLeft}</span>
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => handleRotate(90)} title={t.rotateRight}>
                <RotateCw size={14} />
                <span>{t.rotateRight}</span>
              </button>
              <button className="btn btn-secondary btn-sm" onClick={handleEnhance} title="تحسين التباين">
                <Maximize2 size={14} />
                <span>تباين</span>
              </button>
              <button
                className={`btn ${isCropping ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => setIsCropping(!isCropping)}
                title={t.cropImage}
              >
                <Crop size={14} />
                <span>{t.cropImage}</span>
              </button>
              {originalImage !== imageSrc && (
                <button className="btn btn-secondary btn-sm" onClick={handleResetImage}>
                  {t.resetImage}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Dropzone or Image Preview */}
        {!imageSrc ? (
          <div
            className="dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud size={44} style={{ color: 'var(--primary)' }} />
            <div>
              <p style={{ fontWeight: 600, fontSize: '1rem' }}>{t.dragDropImage}</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.supportedFormats}</p>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept="image/png, image/jpeg, image/jpg, image/webp"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* Image Preview & Crop Canvas container */}
            <div
              style={{
                position: 'relative',
                maxHeight: '380px',
                overflow: 'hidden',
                backgroundColor: 'var(--bg-muted)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border-light)',
              }}
            >
              <img
                ref={imagePreviewRef}
                src={imageSrc}
                alt="Uploaded scan"
                style={{ maxWidth: '100%', maxHeight: '380px', objectFit: 'contain' }}
              />

              {isCropping && (
                <div
                  style={{
                    position: 'absolute',
                    border: '2px dashed var(--primary)',
                    backgroundColor: 'rgba(37, 99, 235, 0.2)',
                    left: `${cropBox.x}px`,
                    top: `${cropBox.y}px`,
                    width: `${cropBox.width}px`,
                    height: `${cropBox.height}px`,
                    cursor: 'move',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'flex-end',
                    padding: '4px',
                  }}
                >
                  <button className="btn btn-primary btn-sm" onClick={handleApplyCrop}>
                    قص
                  </button>
                </div>
              )}
            </div>

            {/* Extracted Text Box */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.88rem', fontWeight: 600 }}>{t.extractedText}:</label>
                {confidence !== null && (
                  <span style={{ fontSize: '0.78rem', color: confidence > 70 ? 'var(--success)' : 'var(--warning)' }}>
                    {t.confidenceScore}: {confidence}%
                  </span>
                )}
              </div>
              <textarea
                className="editor-textarea"
                style={{
                  minHeight: '260px',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.95rem',
                }}
                value={extractedText}
                onChange={(e) => setExtractedText(e.target.value)}
                placeholder="سيظهر النص المستخرج هنا مع إمكانية التعديل والتصحيح اليدوي..."
              />
              {extractedText && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary btn-sm" onClick={handleCopy}>
                    {copied ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
                    <span>{copied ? t.copied : t.copy}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Button & Progress */}
        {imageSrc && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={handleRunOcr}
              disabled={isProcessing}
              style={{ padding: '0.65rem 1.75rem', fontSize: '0.95rem' }}
            >
              <Sparkles size={16} />
              <span>{isProcessing ? t.extracting : t.extractText}</span>
            </button>

            {isProcessing && (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'center' }}>
                <div className="progress-bar-container">
                  <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {progressStatus} ({progressPercent}%)
                </span>
              </div>
            )}

            {errorMessage && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)', fontSize: '0.85rem' }}>
                <AlertCircle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
