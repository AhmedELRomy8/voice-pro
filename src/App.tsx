import { useState, useEffect } from 'react';
import './styles/app.css';
import { Header } from './components/layout/Header';
import { ActionCards } from './components/home/ActionCards';
import { RecentDocs } from './components/home/RecentDocs';
import { DocumentEditor } from './components/editor/DocumentEditor';
import { SpeechModal } from './components/stt/SpeechModal';
import { OcrModal } from './components/ocr/OcrModal';
import { WordLayoutModal } from './components/word/WordLayoutModal';
import { TableModal } from './components/excel/TableModal';
import { SettingsModal } from './components/settings/SettingsModal';
import {
  getAllDocuments,
  saveDocument,
  deleteDocument,
} from './services/storage/idbStorage';
import type { DocumentItem, TableGrid, VoiceCommandMatch } from './types';

export function App() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [currentDoc, setCurrentDoc] = useState<DocumentItem>({
    id: 'default-doc',
    title: 'مستند تجريبي جديد',
    content: 'مرحباً بك في تطبيق أدوات الصوت والمستندات (Voice & Document Tools).\n\nيمكنك البدء بالإملاء الصوتي أو استخراج النصوص والجداول من الصور محلياً بالكامل دون أي اتصال بالإنترنت أو اشتراكات سحابية.',
    type: 'text',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // Modals state
  const [isSpeechOpen, setIsSpeechOpen] = useState(false);
  const [isOcrOpen, setIsOcrOpen] = useState(false);
  const [isWordOpen, setIsWordOpen] = useState(false);
  const [isTableOpen, setIsTableOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTableForModal, setActiveTableForModal] = useState<TableGrid | undefined>(undefined);

  // Load documents from storage on initial mount
  useEffect(() => {
    loadDocs();
  }, []);

  const loadDocs = async () => {
    const list = await getAllDocuments();
    if (list.length > 0) {
      setDocuments(list);
      setCurrentDoc(list[0]);
    } else {
      // Seed initial document into IndexedDB
      const initial: DocumentItem = {
        id: `doc-${Date.now()}`,
        title: 'مستند تجريبي جديد',
        content: 'مرحباً بك في تطبيق أدوات الصوت والمستندات (Voice & Document Tools).\n\nيمكنك البدء بالإملاء الصوتي أو استخراج النصوص والجداول من الصور محلياً بالكامل دون أي اتصال بالإنترنت أو اشتراكات سحابية.',
        type: 'text',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await saveDocument(initial);
      setDocuments([initial]);
      setCurrentDoc(initial);
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
      title: 'مستند جديد',
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
    window.scrollTo({ top: 380, behavior: 'smooth' });
  };

  // Text insertion from Speech or OCR
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

  // Voice Command Dispatcher
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
        // Trigger Word export
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
        // Trigger Excel export
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

  return (
    <div className="app-container">
      {/* Header */}
      <Header onOpenSettings={() => setIsSettingsOpen(true)} />

      {/* Main Container */}
      <main className="main-content">
        {/* 4 Primary Action Cards */}
        <ActionCards
          onSelectSpeech={() => setIsSpeechOpen(true)}
          onSelectOcr={() => setIsOcrOpen(true)}
          onSelectWord={() => setIsWordOpen(true)}
          onSelectExcel={() => {
            setActiveTableForModal(undefined);
            setIsTableOpen(true);
          }}
        />

        {/* Full Document Editor */}
        <DocumentEditor
          currentDoc={currentDoc}
          onSaveDoc={handleSaveDoc}
          onNewDoc={handleNewDoc}
          onTriggerSpeech={() => setIsSpeechOpen(true)}
          onOpenTableModal={(table) => {
            setActiveTableForModal(table);
            setIsTableOpen(true);
          }}
          onExecuteVoiceCommand={(cmd) => {
            const match = { command: cmd as any, phrase: cmd, language: 'ar' as const, confidence: 1 };
            handleExecuteVoiceCommand(match);
          }}
        />

        {/* Recent Documents Section */}
        <RecentDocs
          documents={documents}
          onOpenDoc={handleOpenDoc}
          onDeleteDoc={handleDeleteDoc}
        />
      </main>

      {/* 1. Speech to Text Modal */}
      <SpeechModal
        isOpen={isSpeechOpen}
        onClose={() => setIsSpeechOpen(false)}
        onAppendText={handleAppendText}
        onReplaceText={handleReplaceText}
        onExecuteCommand={handleExecuteVoiceCommand}
      />

      {/* 2. Image to Text OCR Modal */}
      <OcrModal
        isOpen={isOcrOpen}
        onClose={() => setIsOcrOpen(false)}
        onAppendText={handleAppendText}
        onReplaceText={handleReplaceText}
      />

      {/* 3. Image to Word Modal */}
      <WordLayoutModal
        isOpen={isWordOpen}
        onClose={() => setIsWordOpen(false)}
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
        }}
      />

      {/* 4. Image to Excel Modal */}
      <TableModal
        isOpen={isTableOpen}
        onClose={() => setIsTableOpen(false)}
        initialTable={activeTableForModal}
        onSaveTableToDoc={(table) => {
          const updated: DocumentItem = {
            ...currentDoc,
            type: 'excel',
            tableData: table,
            updatedAt: Date.now(),
          };
          handleSaveDoc(updated);
        }}
      />

      {/* Settings & Model Download Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onDataCleared={() => {
          setDocuments([]);
          handleNewDoc();
        }}
      />
    </div>
  );
}

export default App;
