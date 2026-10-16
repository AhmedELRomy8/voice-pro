import React, { useState } from 'react';
import { FileText, FileSpreadsheet, MoreVertical, Trash2, Download, ExternalLink } from 'lucide-react';
import type { DocumentItem } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';
import { generateDocxBlob, downloadBlob } from '../../services/export/docxExporter';
import { generateXlsxBlob } from '../../services/export/xlsxExporter';

interface RecentDocsProps {
  documents: DocumentItem[];
  onOpenDoc: (doc: DocumentItem) => void;
  onDeleteDoc: (id: string) => void;
  onViewAll?: () => void;
}

export const RecentDocs: React.FC<RecentDocsProps> = ({
  documents,
  onOpenDoc,
  onDeleteDoc,
  onViewAll,
}) => {
  const { t, lang } = useTranslation();
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);

  const handleExportQuick = async (doc: DocumentItem) => {
    const filename = `${doc.title || 'document'}.${doc.type === 'excel' ? 'xlsx' : 'docx'}`;
    if (doc.type === 'excel' && doc.tableData) {
      const blob = generateXlsxBlob(doc.tableData);
      downloadBlob(blob, filename);
    } else {
      const blob = await generateDocxBlob({
        title: doc.title,
        content: doc.content,
        tableData: doc.tableData,
        originalImageBase64: doc.originalImagePreview,
      });
      downloadBlob(blob, filename);
    }
  };

  const formatRelativeTime = (timestamp: number) => {
    const diffMs = Date.now() - timestamp;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (lang === 'ar') {
      if (diffHours < 1) return 'معدل منذ لحظات';
      if (diffHours < 24) return `معدل منذ ${diffHours} ${diffHours === 1 ? 'ساعة' : 'ساعات'}`;
      return `معدل منذ ${diffDays} ${diffDays === 1 ? 'يوم' : 'أيام'}`;
    } else {
      if (diffHours < 1) return 'Modified just now';
      if (diffHours < 24) return `Modified ${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
      return `Modified ${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    }
  };

  const getFileBadge = (type: string) => {
    switch (type) {
      case 'excel':
        return { icon: FileSpreadsheet, bg: '#107c41', text: 'xlsx' };
      case 'word':
        return { icon: FileText, bg: '#185abd', text: 'docx' };
      default:
        return { icon: FileText, bg: '#334155', text: 'txt' };
    }
  };

  return (
    <section className="vox-recent-section" aria-labelledby="recent-files-heading">
      <div className="vox-recent-header">
        <h2 id="recent-files-heading" className="vox-recent-title">
          <span>🕒 {t.recentDocuments}</span>
        </h2>
        {onViewAll && (
          <button className="vox-view-all-link" onClick={onViewAll}>
            {lang === 'ar' ? 'عرض الكل' : 'View all'}
          </button>
        )}
      </div>

      <div className="vox-recent-card">
        {documents.length === 0 ? (
          <div className="vox-recent-empty">
            <FileText size={36} style={{ color: 'var(--text-subtle)' }} />
            <p>{t.noDocuments}</p>
          </div>
        ) : (
          <div className="vox-recent-list">
            {documents.slice(0, 5).map((doc) => {
              const badge = getFileBadge(doc.type);
              const BadgeIcon = badge.icon;
              const ext = doc.type === 'excel' ? '.xlsx' : doc.type === 'word' ? '.docx' : '.txt';
              const displayName = doc.title.endsWith(ext) ? doc.title : `${doc.title}${ext}`;

              return (
                <div key={doc.id} className="vox-recent-row">
                  <div className="vox-recent-main" onClick={() => onOpenDoc(doc)}>
                    <div 
                      className="vox-recent-type-icon" 
                      style={{ backgroundColor: badge.bg }}
                    >
                      <BadgeIcon size={18} color="#ffffff" />
                    </div>
                    <div className="vox-recent-text">
                      <span className="vox-recent-name">{displayName}</span>
                      <span className="vox-recent-time">{formatRelativeTime(doc.updatedAt)}</span>
                    </div>
                  </div>

                  {/* Actions 3-dots menu */}
                  <div className="vox-recent-options-container">
                    <button
                      className="vox-options-trigger"
                      onClick={() => setActiveMenuId(activeMenuId === doc.id ? null : doc.id)}
                      title="Options"
                      aria-label="Options"
                    >
                      <MoreVertical size={18} />
                    </button>

                    {activeMenuId === doc.id && (
                      <div className="vox-dropdown-menu">
                        <button
                          className="vox-dropdown-item"
                          onClick={() => {
                            setActiveMenuId(null);
                            onOpenDoc(doc);
                          }}
                        >
                          <ExternalLink size={15} />
                          <span>{t.openDoc}</span>
                        </button>
                        <button
                          className="vox-dropdown-item"
                          onClick={() => {
                            setActiveMenuId(null);
                            handleExportQuick(doc);
                          }}
                        >
                          <Download size={15} />
                          <span>{doc.type === 'excel' ? 'Export XLSX' : 'Export DOCX'}</span>
                        </button>
                        <button
                          className="vox-dropdown-item text-danger"
                          onClick={() => {
                            setActiveMenuId(null);
                            setDocToDelete(doc.id);
                          }}
                        >
                          <Trash2 size={15} />
                          <span>{t.deleteDoc}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {docToDelete && (
        <div className="modal-backdrop" onClick={() => setDocToDelete(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{t.deleteDoc}</h3>
            </div>
            <div className="modal-body">
              <p>{t.deleteDocConfirm}</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDocToDelete(null)}>
                {t.cancel}
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  onDeleteDoc(docToDelete);
                  setDocToDelete(null);
                }}
              >
                {t.deleteDoc}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
