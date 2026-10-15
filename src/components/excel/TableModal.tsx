import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileDown,
  Sparkles,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileText
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
  const [table, setTable] = useState<TableGrid | null>(initialTable || null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [detectionMessage, setDetectionMessage] = useState<string>('');
  const [isReliable, setIsReliable] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('table-data');

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
      setTable(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDetectTable = async () => {
    if (!imageSrc) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const ocrResult = await performOcr(imageSrc, 'ara+eng');
      const detection = detectTableFromOcr(ocrResult.lines);

      setTable(detection.table);
      setIsReliable(detection.isReliable);
      setDetectionMessage(detection.message);
    } catch (err: any) {
      setErrorMessage(err.message || 'فشل كشف الجدول في الصورة');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCellChange = (rIdx: number, cIdx: number, val: string) => {
    if (!table) return;
    setTable(updateCellValue(table, rIdx, cIdx, val));
  };

  const handleAddRow = () => {
    if (!table) return;
    setTable(addRow(table));
  };

  const handleDeleteRow = (rIdx: number) => {
    if (!table) return;
    setTable(deleteRow(table, rIdx));
  };

  const handleAddCol = () => {
    if (!table) return;
    setTable(addColumn(table));
  };

  const handleDeleteCol = (cIdx: number) => {
    if (!table) return;
    setTable(deleteColumn(table, cIdx));
  };

  const handleExportXlsx = () => {
    if (!table || table.rows.length === 0) return;
    const blob = generateXlsxBlob(table);
    downloadBlob(blob, `${fileName || 'table'}.xlsx`);
  };

  const handleApplyToDoc = () => {
    if (table && onSaveTableToDoc) {
      onSaveTableToDoc(table);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.tableModalTitle}
      size="large"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            {t.cancel}
          </button>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {table && table.rows.length > 0 && (
              <>
                {onSaveTableToDoc && (
                  <button className="btn btn-secondary" onClick={handleApplyToDoc}>
                    {t.appendToEditor}
                  </button>
                )}
                <button className="btn btn-success" onClick={handleExportXlsx}>
                  <FileDown size={16} />
                  <span>{t.exportToExcelButton}</span>
                </button>
              </>
            )}
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Upload Dropzone */}
        {!imageSrc && !table ? (
          <div
            className="dropzone"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
            }}
          >
            <UploadCloud size={44} style={{ color: 'var(--success)' }} />
            <div>
              <p style={{ fontWeight: 600 }}>{t.dragDropImage}</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                حدد صورة جدول مطبوع ليتم كشفه وتحويله لإكسل
              </p>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            />
          </div>
        ) : null}

        {imageSrc && !table && (
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <button
              className="btn btn-primary"
              onClick={handleDetectTable}
              disabled={isProcessing}
              style={{ padding: '0.75rem 2rem' }}
            >
              <Sparkles size={16} />
              <span>{isProcessing ? t.detectingTable : 'كشف الجدول واستخراج الخلايا هندسياً'}</span>
            </button>
          </div>
        )}

        {/* Feedback Banner */}
        {detectionMessage && (
          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              backgroundColor: isReliable ? 'var(--success-light)' : 'var(--warning-light)',
              border: `1px solid ${isReliable ? 'var(--success-border)' : 'var(--warning-border)'}`,
              color: isReliable ? 'var(--success)' : 'var(--warning)',
            }}
          >
            {isReliable ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{detectionMessage}</span>
          </div>
        )}

        {/* Editable Table Grid */}
        {table && table.rows.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-secondary btn-sm" onClick={handleAddRow}>
                  <Plus size={14} />
                  <span>{t.addRow}</span>
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleAddCol}>
                  <Plus size={14} />
                  <span>{t.addCol}</span>
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>اسم الملف:</label>
                <input
                  type="text"
                  className="search-input"
                  style={{ width: '160px', padding: '0.25rem 0.5rem' }}
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                />
              </div>
            </div>

            {/* Grid Container */}
            <div className="table-grid-container">
              <table className="table-grid">
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                    {table.rows[0]?.cells.map((_, cIdx) => (
                      <th key={cIdx} style={{ minWidth: '120px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>عمود {cIdx + 1}</span>
                          <button
                            className="btn btn-secondary btn-icon"
                            style={{ padding: '2px', color: 'var(--danger)' }}
                            onClick={() => handleDeleteCol(cIdx)}
                            title={t.deleteCol}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </th>
                    ))}
                    <th style={{ width: '40px', textAlign: 'center' }}>حذف</th>
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, rIdx) => (
                    <tr key={row.id}>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        {rIdx + 1}
                      </td>
                      {row.cells.map((cell, cIdx) => (
                        <td key={cell.id}>
                          <input
                            type="text"
                            className="table-cell-input"
                            value={cell.value}
                            onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                          />
                        </td>
                      ))}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn btn-secondary btn-icon"
                          style={{ padding: '2px', color: 'var(--danger)' }}
                          onClick={() => handleDeleteRow(rIdx)}
                          title={t.deleteRow}
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
