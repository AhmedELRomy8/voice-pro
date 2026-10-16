import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { Modal } from '../layout/Modal';
import { useTranslation } from '../../i18n/useTranslation';
import { performOcr } from '../../services/ocr/tesseractWorker';
import {
  detectTableFromOcr,
  addRow,
  deleteRow,
  addColumn,
  deleteColumn,
  updateCellValue,
} from '../../services/table/tableDetector';
import { generateXlsxBlob } from '../../services/export/xlsxExporter';
import { downloadBlob } from '../../services/export/docxExporter';
import { isPdfFile, processPdfFile } from '../../services/pdf/pdfService';
import type { TableGrid } from '../../types';

interface TableModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTable?: TableGrid;
  onSaveTableToDoc?: (table: TableGrid) => void;
}

export const TableModal: React.FC<TableModalProps> = ({
  isOpen,
  onClose,
  initialTable,
  onSaveTableToDoc,
}) => {
  const { t } = useTranslation();

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [isPdf, setIsPdf] = useState<boolean>(false);
  const [table, setTable] = useState<TableGrid | null>(
    initialTable || {
      rows: [
        { id: 'r1', cells: [{ id: 'c1', value: '100' }, { id: 'c2', value: '2' }, { id: 'c3', value: '95' }, { id: 'c4', value: 'أحمد علي' }] },
        { id: 'r2', cells: [{ id: 'c5', value: '100' }, { id: 'c6', value: '5' }, { id: 'c7', value: '88' }, { id: 'c8', value: 'سارة محمد' }] },
        { id: 'r3', cells: [{ id: 'c9', value: '100' }, { id: 'c10', value: '8' }, { id: 'c11', value: '76' }, { id: 'c12', value: 'علي حسن' }] },
        { id: 'r4', cells: [{ id: 'c13', value: '100' }, { id: 'c14', value: '3' }, { id: 'c15', value: '92' }, { id: 'c16', value: 'مريم خالد' }] },
      ],
      headers: ['المجموع', 'الغياب', 'الدرجة', 'الاسم'],
      detectedConfidence: 0.95,
    }
  );
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [detectionMessage, setDetectionMessage] = useState<string>('');
  const [isReliable, setIsReliable] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedFileRef = useRef<File | null>(null);

  const handleFileSelect = async (file: File) => {
    setErrorMessage(null);
    selectedFileRef.current = file;
    setSelectedFileName(file.name);

    if (isPdfFile(file)) {
      setIsPdf(true);
      setIsProcessing(true);
      setDetectionMessage('جارٍ فحص واكتشاف الجداول من ملف PDF...');

      try {
        const result = await processPdfFile(file);
        if (result.pages.length > 0 && result.pages[0].renderedImageUrl) {
          setImageSrc(result.pages[0].renderedImageUrl);
        }

        // If digital tables were found in the PDF
        if (result.detectedTables.length > 0) {
          setTable(result.detectedTables[0]);
          setIsReliable(true);
          setDetectionMessage('تم استخراج الجدول من ملف الـ PDF بنجاح وبدقة 100%!');
        } else if (result.pages.length > 0 && result.pages[0].renderedImageUrl) {
          // Fallback to OCR table detection from page 1 canvas
          const ocrRes = await performOcr(result.pages[0].renderedImageUrl, 'ara+eng');
          const detection = detectTableFromOcr(ocrRes.lines);
          setTable(detection.table);
          setIsReliable(detection.isReliable);
          setDetectionMessage(detection.message);
        }
      } catch (err: any) {
        setErrorMessage(`تعذر قراءة جداول PDF: ${err.message || err}`);
      } finally {
        setIsProcessing(false);
      }
    } else if (file.type.startsWith('image/')) {
      setIsPdf(false);
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        setImageSrc(dataUrl);

        setIsProcessing(true);
        setDetectionMessage('جارٍ قراءة الصورة واكتشاف الجداول...');
        try {
          const ocrRes = await performOcr(dataUrl, 'ara+eng');
          const detection = detectTableFromOcr(ocrRes.lines);
          setTable(detection.table);
          setIsReliable(detection.isReliable);
          setDetectionMessage(detection.message);
        } catch (err: any) {
          setErrorMessage(err.message || 'فشل كشف الجدول من الصورة');
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    } else {
      setErrorMessage('يرجى اختيار صورة صالحة أو ملف PDF يحتوي على جدول.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    if (!table) return;
    const updated = updateCellValue(table, rowIndex, colIndex, value);
    setTable(updated);
  };

  const handleAddRow = () => {
    if (!table) return;
    setTable(addRow(table));
  };

  const handleDeleteRow = (index: number) => {
    if (!table) return;
    setTable(deleteRow(table, index));
  };

  const handleAddColumn = () => {
    if (!table) return;
    setTable(addColumn(table));
  };

  const handleDeleteColumn = (index: number) => {
    if (!table) return;
    setTable(deleteColumn(table, index));
  };

  const handleExportXlsx = () => {
    if (!table) return;
    const blob = generateXlsxBlob(table);
    const fname = selectedFileName
      ? `${selectedFileName.replace(/\.[^/.]+$/, '')}_table.xlsx`
      : 'voxnote_table.xlsx';
    downloadBlob(blob, fname);

    if (onSaveTableToDoc) {
      onSaveTableToDoc(table);
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Image to Excel"
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
              className="btn btn-success"
              onClick={handleExportXlsx}
              disabled={!table || table.rows.length === 0}
            >
              <FileSpreadsheet size={16} />
              <span>Export to Excel</span>
            </button>
          </div>
        </div>
      }
    >
      <div className="vox-screen-container">
        <p className="vox-screen-subtitle">Convert table images or PDF to Excel.</p>

        {/* Drag & Drop Area */}
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

        {isProcessing && (
          <div className="vox-progress-container">
            <div className="vox-progress-label">
              <span>{detectionMessage || 'Processing table...'}</span>
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: '80%' }} />
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="vox-error-box">
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Detected Table Preview Section */}
        {table && table.rows.length > 0 && (
          <div className="vox-table-preview-section">
            <div className="vox-table-preview-header">
              <label className="vox-label font-bold">Detected Table Preview</label>
              <div className="vox-table-tools">
                <button className="btn btn-secondary btn-sm" onClick={handleAddRow}>
                  <Plus size={14} /><span>Add Row</span>
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleAddColumn}>
                  <Plus size={14} /><span>Add Column</span>
                </button>
              </div>
            </div>

            <div className="vox-table-grid-wrap">
              <table className="vox-data-table">
                {table.headers && table.headers.length > 0 && (
                  <thead>
                    <tr>
                      {table.headers.map((h, hIdx) => (
                        <th key={`head-${hIdx}`}>{h}</th>
                      ))}
                      <th style={{ width: 40 }}></th>
                    </tr>
                  </thead>
                )}
                <tbody>
                  {table.rows.map((row, rIdx) => (
                    <tr key={row.id || `row-${rIdx}`}>
                      {row.cells.map((cell, cIdx) => (
                        <td key={cell.id || `c-${rIdx}-${cIdx}`}>
                          <input
                            type="text"
                            className="vox-cell-input"
                            value={cell.value}
                            onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                          />
                        </td>
                      ))}
                      <td className="text-center">
                        <button
                          className="vox-cell-del-btn"
                          onClick={() => handleDeleteRow(rIdx)}
                          title="Delete row"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
