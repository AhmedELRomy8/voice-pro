import { useState, useEffect } from 'react';
import './styles/app.css';
import './styles/login.css';
import { Sidebar, type NavigationTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { ActionCards } from './components/home/ActionCards';
import { RecentDocs } from './components/home/RecentDocs';
import { DocumentEditor } from './components/editor/DocumentEditor';
import { SpeechModal } from './components/stt/SpeechModal';
import { OcrModal } from './components/ocr/OcrModal';
import { WordLayoutModal } from './components/word/WordLayoutModal';
import { TableModal } from './components/excel/TableModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { LoginPage } from './components/auth/LoginPage';
import {
  getAllDocuments,
  saveDocument,
  deleteDocument,
} from './services/storage/idbStorage';
import {
  getStoredUser,
  clearUser,
  type UserProfile,
} from './services/auth/authService';
import type { DocumentItem, TableGrid, VoiceCommandMatch } from './types';
import { useTranslation } from './i18n/useTranslation';

export function App() {
  const { lang } = useTranslation();

  const [user, setUser] = useState<UserProfile | null>(() => getStoredUser());
  const [showLoginModal, setShowLoginModal] = useState<boolean>(() => !getStoredUser());

  const [activeTab, setActiveTab] = useState<NavigationTab>('home');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [currentDoc, setCurrentDoc] = useState<DocumentItem>({
    id: 'default-doc',
    title: 'meeting_notes',
    content: 'مرحباً بك في VoxNote (Your Voice. Your Documents).\n\nيمكنك البدء بالإملاء الصوتي المباشر فائق السرعة، أو استخراج النصوص والجداول من الصور وملفات الـ PDF وتحويلها إلى Word DOCX أو Excel XLSX محلياً بالكامل.',
    type: 'word',
    createdAt: Date.now() - 7200000,
    updatedAt: Date.now() - 7200000,
  });

  const [activeTableForModal, setActiveTableForModal] = useState<TableGrid | undefined>(undefined);

  // Load documents from storage
  useEffect(() => {
    loadDocs();
  }, []);

  const loadDocs = async () => {
    const list = await getAllDocuments();
    if (list.length > 0) {
      setDocuments(list);
      setCurrentDoc(list[0]);
    } else {
      // Seed default items matching clean layout
      const doc1: DocumentItem = {
        id: `doc-${Date.now()}-1`,
        title: 'meeting_notes',
        content: 'ملخص اجتماع العمل — مناقشة خطة المشروع والمهام المطلوبة وتوزيع المسؤوليات على الفريق.',
        type: 'word',
        createdAt: Date.now() - 7200000,
        updatedAt: Date.now() - 7200000,
      };
      const doc2: DocumentItem = {
        id: `doc-${Date.now()}-2`,
        title: 'table',
        content: '',
        type: 'excel',
        tableData: {
          rows: [
            { id: '1', cells: [{ id: '1', value: '100' }, { id: '2', value: '2' }, { id: '3', value: '95' }, { id: '4', value: 'أحمد علي' }] },
            { id: '2', cells: [{ id: '5', value: '100' }, { id: '6', value: '5' }, { id: '7', value: '88' }, { id: '8', value: 'سارة محمد' }] },
            { id: '3', cells: [{ id: '9', value: '100' }, { id: '10', value: '8' }, { id: '11', value: '76' }, { id: '12', value: 'علي حسن' }] },
          ],
          headers: ['المجموع', 'الغياب', 'الدرجة', 'الاسم'],
          detectedConfidence: 0.95,
        },
        createdAt: Date.now() - 18000000,
        updatedAt: Date.now() - 18000000,
      };
      const doc3: DocumentItem = {
        id: `doc-${Date.now()}-3`,
        title: 'document',
        content: 'مستند نصي سريع تم إملاؤه عبر الصوت.',
        type: 'text',
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now() - 86400000,
      };
      await saveDocument(doc1);
      await saveDocument(doc2);
      await saveDocument(doc3);
      setDocuments([doc1, doc2, doc3]);
      setCurrentDoc(doc1);
    }
  };

  const handleSaveDoc = async (docToSave: DocumentItem): Promise<boolean> => {
    const success = await saveDocument(docToSave);
    if (success) {
      setCurrentDoc(docToSave);
      setDocuments((prev) => {
        const filtered = prev.filter((d) => d.id !== docToSave.id);
        return [docToSave, ...filtered];
      });
    }
    return success;
  };

  const handleNewDoc = () => {
    const newDoc: DocumentItem = {
      id: `doc-${Date.now()}`,
      title: 'new_document',
      content: '',
      type: 'text',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setCurrentDoc(newDoc);
    handleSaveDoc(newDoc);
  };

  const handleDeleteDoc = async (id: string) => {
    await deleteDocument(id);
    const updated = documents.filter((d) => d.id !== id);
    setDocuments(updated);
    if (currentDoc.id === id) {
      if (updated.length > 0) {
        setCurrentDoc(updated[0]);
      } else {
        handleNewDoc();
      }
    }
  };

  const handleOpenDoc = (doc: DocumentItem) => {
    setCurrentDoc(doc);
    setActiveTab('home');
    window.scrollTo({ top: 380, behavior: 'smooth' });
  };

  const handleAppendText = (text: string) => {
    const newContent = currentDoc.content
      ? `${currentDoc.content}\n\n${text}`
      : text;
    const updated: DocumentItem = {
      ...currentDoc,
      content: newContent,
      updatedAt: Date.now(),
    };
    handleSaveDoc(updated);
  };

  const handleReplaceText = (text: string) => {
    const updated: DocumentItem = {
      ...currentDoc,
      content: text,
      updatedAt: Date.now(),
    };
    handleSaveDoc(updated);
  };

  const handleTabSelect = (tab: NavigationTab) => {
    setActiveTab(tab);
    setMobileSidebarOpen(false);
    if (tab === 'excel') {
      setActiveTableForModal(undefined);
    }
  };

  const handleLogout = () => {
    clearUser();
    setUser(null);
    setShowLoginModal(true);
  };

  const handleExecuteVoiceCommand = (match: VoiceCommandMatch) => {
    switch (match.command) {
      case 'save':
        handleSaveDoc(currentDoc);
        break;
      case 'new':
        handleNewDoc();
        break;
      case 'copy':
        navigator.clipboard.writeText(currentDoc.content);
        break;
      case 'clear':
        handleReplaceText('');
        break;
      case 'export_word':
        import('./services/export/docxExporter').then(({ generateDocxBlob, downloadBlob }) => {
          generateDocxBlob({
            title: currentDoc.title,
            content: currentDoc.content,
            tableData: currentDoc.tableData,
            originalImageBase64: currentDoc.originalImagePreview,
          }).then((blob) => downloadBlob(blob, `${currentDoc.title}.docx`));
        });
        break;
      case 'export_excel':
        import('./services/export/xlsxExporter').then(({ generateXlsxBlob, exportTextLinesToXlsx }) => {
          if (currentDoc.tableData) {
            import('./services/export/docxExporter').then(({ downloadBlob }) => {
              const blob = generateXlsxBlob(currentDoc.tableData!);
              downloadBlob(blob, `${currentDoc.title}.xlsx`);
            });
          } else {
            exportTextLinesToXlsx(currentDoc.content, `${currentDoc.title}.xlsx`);
          }
        });
        break;
    }
  };

  const filteredDocs = documents.filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q);
  });

  // Render Login page if not authenticated or user triggered login
  if (showLoginModal) {
    return (
      <LoginPage
        onLoginSuccess={(loggedInUser) => {
          setUser(loggedInUser);
          setShowLoginModal(false);
        }}
      />
    );
  }

  return (
    <div className="vox-app-layout">
      {/* 1. Left Sleek Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleTabSelect}
        isOpenMobile={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* 2. Main Content Area */}
      <div className="vox-main-wrapper">
        {/* Top Header */}
        <Header
          user={user}
          onOpenSettings={() => setActiveTab('settings')}
          onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          onLogout={handleLogout}
          onOpenLogin={() => setShowLoginModal(true)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Workspace Body */}
        <main className="vox-workspace">
          {/* Active Dedicated Page Views */}
          {activeTab === 'speech' && (
            <SpeechModal
              isPageView={true}
              isOpen={true}
              onClose={() => setActiveTab('home')}
              onAppendText={handleAppendText}
              onReplaceText={handleReplaceText}
              onExecuteCommand={handleExecuteVoiceCommand}
            />
          )}

          {activeTab === 'ocr' && (
            <OcrModal
              isPageView={true}
              isOpen={true}
              onClose={() => setActiveTab('home')}
              onAppendText={handleAppendText}
              onReplaceText={handleReplaceText}
            />
          )}

          {activeTab === 'word' && (
            <WordLayoutModal
              isPageView={true}
              isOpen={true}
              onClose={() => setActiveTab('home')}
              onApplyToDocument={(title, content) => {
                const updated: DocumentItem = {
                  id: `doc-${Date.now()}`,
                  title,
                  content,
                  type: 'word',
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                };
                handleSaveDoc(updated);
                setActiveTab('home');
              }}
            />
          )}

          {activeTab === 'excel' && (
            <TableModal
              isPageView={true}
              isOpen={true}
              onClose={() => setActiveTab('home')}
              initialTable={activeTableForModal}
              onSaveTableToDoc={(table) => {
                const updated: DocumentItem = {
                  ...currentDoc,
                  type: 'excel',
                  tableData: table,
                  updatedAt: Date.now(),
                };
                handleSaveDoc(updated);
                setActiveTab('home');
              }}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsModal
              isPageView={true}
              isOpen={true}
              onClose={() => setActiveTab('home')}
              onDataCleared={() => {
                setDocuments([]);
                handleNewDoc();
                setActiveTab('home');
              }}
            />
          )}

          {/* Home / Recent Dashboard View */}
          {(activeTab === 'home' || activeTab === 'recent') && (
            <>
              {/* Greeting Banner */}
              <div className="vox-greeting-header">
                <h1 className="vox-greeting-title">
                  {lang === 'ar'
                    ? `صباح الخير${user?.name ? '، ' + user.name : ''} 👋`
                    : `Good day${user?.name ? ', ' + user.name : ''} 👋`}
                </h1>
                <p className="vox-greeting-sub">
                  {lang === 'ar'
                    ? 'ماذا تريد أن تنجز اليوم في VoxNote؟'
                    : 'What would you like to accomplish today in VoxNote?'}
                </p>
              </div>

              {/* 4 Colored Action Cards */}
              <ActionCards
                onSelectSpeech={() => setActiveTab('speech')}
                onSelectOcr={() => setActiveTab('ocr')}
                onSelectWord={() => setActiveTab('word')}
                onSelectExcel={() => {
                  setActiveTableForModal(undefined);
                  setActiveTab('excel');
                }}
              />

              {/* Recent Files Section */}
              <RecentDocs
                documents={filteredDocs}
                onOpenDoc={handleOpenDoc}
                onDeleteDoc={handleDeleteDoc}
                onViewAll={() => setActiveTab('recent')}
              />

              {/* Full Document Editor */}
              <section className="vox-editor-section">
                <DocumentEditor
                  currentDoc={currentDoc}
                  onSaveDoc={handleSaveDoc}
                  onNewDoc={handleNewDoc}
                  onTriggerSpeech={() => setActiveTab('speech')}
                  onOpenTableModal={(table) => {
                    setActiveTableForModal(table);
                    setActiveTab('excel');
                  }}
                  onExecuteVoiceCommand={(cmd) => {
                    const match = { command: cmd as any, phrase: cmd, language: 'ar' as const, confidence: 1 };
                    handleExecuteVoiceCommand(match);
                  }}
                />
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
