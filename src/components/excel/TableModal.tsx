import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Plus,
  Trash2,
  AlertCircle,
  FileText,
  X
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
  isPageView?: boolean;
}

export const TableModal: React.FC<TableModalProps> = ({
  isOpen,
  onClose,
  initialTable,
  onSaveTableToDoc,
  isPageView = false,
}) => {
  const { t, lang } = useTranslation();
  const isRtl = lang === 'ar';

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
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedFileRef = useRef<File | null>(null);

  const handleFileSelect = async (file: File) => {
    setErrorMessage(null);
    selectedFileRef.current = file;
    setSelectedFileName(file.name);

    if (isPdfFile(file)) {
      setIsPdf(true);
      setIsProcessing(true);
      setProgressStatus(isRtl ? 'جارٍ فحص ملف PDF واكتشاف الجداول...' : 'Scanning PDF for tables...');
      setProgressPercent(20);

      try {
        const result = await processPdfFile(file, (msg, c, tot) => {
          setProgressStatus(msg);
          setProgressPercent(10 + Math.round((c / (tot || 1)) * 50));
        });
        if (result.pages.length > 0 && result.pages[0].renderedImageUrl) {
          setImageSrc(result.pages[0].renderedImageUrl);
        }
        if (result.detectedTables.length > 0) {
          setTable(result.detectedTables[0]);
          setProgressStatus(isRtl ? 'تم استخراج الجدول بنجاح ✓' : 'Table extracted successfully ✓');
        } else if (result.pages.length > 0 && result.pages[0].renderedImageUrl) {
          setProgressStatus(isRtl ? 'جارٍ تحليل الصورة باستخدام OCR...' : 'Analyzing image with OCR...');
          setProgressPercent(70);
          const ocrRes = await performOcr(result.pages[0].renderedImageUrl, 'ara+eng');
          const detection = detectTableFromOcr(ocrRes.lines);
          setTable(detection.table);
          setProgressStatus(detection.message);
        }
        setProgressPercent(100);
      } catch (err: any) {
        setErrorMessage(`${isRtl ? 'تعذر قراءة جداول PDF' : 'Failed to read PDF tables'}: ${err.message || err}`);
      } finally {
        setIsProcessing(false);
        setProgressPercent(0);
      }
    } else if (file.type.startsWith('image/')) {
      setIsPdf(false);
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        setImageSrc(dataUrl);
        setIsProcessing(true);
        setProgressStatus(isRtl ? 'جارٍ قراءة الصورة واكتشاف الجدول...' : 'Reading image and detecting table...');
        setProgressPercent(30);
        try {
          const ocrRes = await performOcr(dataUrl, 'ara+eng', (p) => {
            setProgressPercent(30 + Math.round(p.progress * 60));
          });
          const detection = detectTableFromOcr(ocrRes.lines);
          setTable(detection.table);
          setProgressStatus(detection.message);
          setProgressPercent(100);
        } catch (err: any) {
          setErrorMessage(err.message || (isRtl ? 'فشل كشف الجدول من الصورة' : 'Failed to detect table'));
        } finally {
          setIsProcessing(false);
          setProgressPercent(0);
        }
      };
      reader.readAsDataURL(file);
    } else {
      setErrorMessage(isRtl
        ? 'يرجى اختيار صورة صالحة أو ملف PDF يحتوي على جدول.'
        : 'Please choose an image or PDF containing a table.');
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
    setErrorMessage(null);
    selectedFileRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    if (!table) return;
    setTable(updateCellValue(table, rowIndex, colIndex, value));
  };

  const handleExportXlsx = () => {
    if (!table) return;
    const blob = generateXlsxBlob(table);
    const fname = selectedFileName
      ? `${selectedFileName.replace(/\.[^/.]+$/, '')}_table.xlsx`
      : 'voxnote_table.xlsx';
    downloadBlob(blob, fname);
    if (onSaveTableToDoc) onSaveTableToDoc(table);
    onClose();
  };

  const footerButtons = (
    <div className="vox-modal-footer-row">
      <div className="vox-modal-footer-left">
        <button className="btn btn-secondary" onClick={onClose}>
          {isRtl ? 'رجوع' : 'Back'}
        </button>
      </div>
      <div className="vox-modal-footer-right">
        <button
          className="btn btn-success"
          onClick={handleExportXlsx}
          disabled={!table || table.rows.length === 0}
        >
          <FileSpreadsheet size={16} />
          <span>{isRtl ? 'تصدير Excel (XLSX)' : 'Export to Excel'}</span>
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
                {isRtl ? 'تم تحميل الملف ✓' : 'File loaded ✓'}
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
              {isRtl ? 'اسحب صورة أو PDF يحتوي على جدول' : 'Drag & drop image or PDF with a table'}
            </div>
            <div className="vox-dropzone-or">{isRtl ? 'أو' : 'or'}</div>
            <button type="button" className="vox-choose-btn" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
              {isRtl ? 'اختر ملفاً' : 'Choose File'}
            </button>
            <div className="vox-dropzone-formats">PNG, JPG, PDF</div>
          </>
        )}
      </div>

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

      {/* Table Preview + Edit */}
      {table && table.rows.length > 0 && (
        <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          {/* Table toolbar */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0.65rem 0.85rem', background: 'var(--bg-muted)',
            borderBottom: '1px solid var(--border-light)', gap: '0.5rem', flexWrap: 'wrap'
          }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {isRtl
                ? `معاينة الجدول — ${table.rows.length} صفوف × ${table.rows[0]?.cells.length || 0} أعمدة`
                : `Table Preview — ${table.rows.length} rows × ${table.rows[0]?.cells.length || 0} cols`}
            </span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setTable(addRow(table))}>
                <Plus size={13} />
                <span>{isRtl ? 'صف' : 'Row'}</span>
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setTable(addColumn(table))}>
                <Plus size={13} />
                <span>{isRtl ? 'عمود' : 'Col'}</span>
              </button>
            </div>
          </div>

          {/* Scrollable Table */}
          <div style={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }} dir="rtl">
            <table className="vox-data-table" style={{ minWidth: '100%' }}>
              {table.headers && table.headers.length > 0 && (
                <thead>
                  <tr>
                    {table.headers.map((h, hIdx) => (
                      <th key={`head-${hIdx}`} style={{ textAlign: 'center', padding: '0.5rem 0.6rem', background: '#f1f5f9', fontWeight: 700, fontSize: '0.83rem', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                    <th style={{ width: 36, background: '#f1f5f9' }}></th>
                  </tr>
                </thead>
              )}
              <tbody>
                {table.rows.map((row, rIdx) => (
                  <tr key={row.id || `row-${rIdx}`} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    {row.cells.map((cell, cIdx) => (
                      <td key={cell.id || `c-${rIdx}-${cIdx}`} style={{ padding: '0.2rem' }}>
                        <input
                          type="text"
                          className="vox-cell-input"
                          value={cell.value}
                          onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                          dir={/[\u0600-\u06FF]/.test(cell.value) ? 'rtl' : 'ltr'}
                          style={{ textAlign: /[\u0600-\u06FF]/.test(cell.value) ? 'right' : 'left' }}
                        />
                      </td>
                    ))}
                    <td style={{ padding: '0.2rem', textAlign: 'center' }}>
                      <button
                        className="vox-cell-del-btn"
                        onClick={() => setTable(deleteRow(table, rIdx))}
                        title={isRtl ? 'حذف الصف' : 'Delete row'}
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
  );

  if (isPageView) {
    return (
      <div className="vox-page-view-card">
        <div className="vox-page-view-header">
          <div className="vox-page-view-title-wrap">
            <h2 className="vox-page-view-title">
              {isRtl ? 'تحويل الجداول إلى Excel' : 'Image & PDF to Excel'}
            </h2>
            <p className="vox-page-view-sub">
              {isRtl ? 'ارفع صورة أو PDF يحتوي على جدول وعدّل الخلايا وصدّره XLSX' : 'Upload an image or PDF, edit cells, and export to Excel'}
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
    <Modal isOpen={isOpen} onClose={onClose} title={isRtl ? 'تحويل إلى Excel' : 'Image to Excel'} size="large" footer={footerButtons}>
      {mainContent}
    </Modal>
  );
};
