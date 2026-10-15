import React, { useState } from 'react';
import { Search, FileText, Trash2, ExternalLink, Download } from 'lucide-react';
import type { DocumentItem } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';
import { generateDocxBlob, downloadBlob } from '../../services/export/docxExporter';
import { generateXlsxBlob } from '../../services/export/xlsxExporter';

interface RecentDocsProps {
  documents: DocumentItem[];
  onOpenDoc: (doc: DocumentItem) => void;
  onDeleteDoc: (id: string) => void;
}

export const RecentDocs: React.FC<RecentDocsProps> = ({
  documents,
  onOpenDoc,
  onDeleteDoc,
}) => {
  const { t, lang } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [docToDelete, setDocToDelete] = useState<string | null>(null);

  const filteredDocs = documents.filter((doc) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      doc.title.toLowerCase().includes(q) ||
      doc.content.toLowerCase().includes(q)
    );
  });

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

  const formatDate = (timestamp: number) => {
    try {
      return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(timestamp));
    } catch {
      return new Date(timestamp).toLocaleDateString();
    }
  };

  return (
    <section className="documents-section" aria-labelledby="recent-docs-heading">
      <div className="section-header">
        <h2 id="recent-docs-heading" className="section-title">
          <FileText size={20} />
          <span>{t.recentDocuments}</span>
        </h2>

        <div className="search-wrapper" style={{ maxWidth: '280px' }}>
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={t.searchPlaceholder}
          />
        </div>
      </div>

      <div className="documents-card">
        {filteredDocs.length === 0 ? (
          <div className="doc-list-empty">
            <FileText size={36} style={{ color: 'var(--text-subtle)' }} />
            <p>{t.noDocuments}</p>
          </div>
        ) : (
          filteredDocs.map((doc) => (
            <div key={doc.id} className="doc-item">
              <div className="doc-info" onClick={() => onOpenDoc(doc)}>
                <div className="doc-title" title={doc.title}>
                  {doc.title || t.editorTitlePlaceholder}
                </div>
                <div className="doc-meta">
                  <span className="doc-type-badge">{doc.type}</span>
                  <span>{formatDate(doc.updatedAt)}</span>
                  <span>•</span>
                  <span>
                    {doc.content
                      ? `${doc.content.slice(0, 50)}${doc.content.length > 50 ? '...' : ''}`
                      : '—'}
                  </span>
                </div>
              </div>

              <div className="doc-actions">
                <button
                  className="btn btn-secondary btn-icon"
                  onClick={() => handleExportQuick(doc)}
                  title={`${doc.type === 'excel' ? t.exportXlsx : t.exportDocx}`}
                >
                  <Download size={16} />
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => onOpenDoc(doc)}
                  title={t.openDoc}
                >
                  <ExternalLink size={14} />
                  <span>{t.openDoc}</span>
                </button>
                <button
                  className="btn btn-secondary btn-icon"
                  style={{ color: 'var(--danger)' }}
                  onClick={() => setDocToDelete(doc.id)}
                  title={t.deleteDoc}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete confirmation modal */}
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
