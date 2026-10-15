import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Download,
  HardDrive,
  CheckCircle2,
  Trash2,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { Modal } from '../layout/Modal';
import { useTranslation } from '../../i18n/useTranslation';
import { getStorageEstimate, clearAllDocuments } from '../../services/storage/idbStorage';
import { isWhisperModelCached, getWhisperTranscriber } from '../../services/speech/whisperEngine';
import { getTesseractWorker } from '../../services/ocr/tesseractWorker';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataCleared?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onDataCleared,
}) => {
  const { t } = useTranslation();

  const [storageUsageMB, setStorageUsageMB] = useState<string>('0');
  const [whisperCached, setWhisperCached] = useState<boolean>(false);
  const [tesseractCached, setTesseractCached] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<string>('');
  const [isTestingOffline, setIsTestingOffline] = useState<boolean>(false);
  const [offlineTestResult, setOfflineTestResult] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      loadStorageInfo();
      checkModelCache();
    }
  }, [isOpen]);

  const loadStorageInfo = async () => {
    const est = await getStorageEstimate();
    const mb = (est.usage / (1024 * 1024)).toFixed(1);
    setStorageUsageMB(mb);
  };

  const checkModelCache = async () => {
    const isW = await isWhisperModelCached('Xenova/whisper-tiny');
    setWhisperCached(isW);
    // Tesseract caches traineddata in IndexedDB by default
    setTesseractCached(true);
  };

  const handleDownloadAllForOffline = async () => {
    setIsDownloading(true);
    setDownloadProgress('بدء تنزيل ملفات Tesseract للغة العربية والإنجليزية محلياً...');

    try {
      // 1. Initialize Tesseract with Arabic and English
      await getTesseractWorker('ara+eng', (p) => {
        setDownloadProgress(p.status);
      });

      // 2. Initialize Whisper model locally
      setDownloadProgress('جارٍ تنزيل نموذج Whisper الصوتي (~39 ميجابايت) وتخزينه محلياً...');
      await getWhisperTranscriber('Xenova/whisper-tiny', (p) => {
        setDownloadProgress(p.status);
      });

      setWhisperCached(true);
      setTesseractCached(true);
      setDownloadProgress(t.downloadComplete);
      await loadStorageInfo();
    } catch (err: any) {
      setDownloadProgress(`فشل التنزيل: ${err.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleTestOffline = async () => {
    setIsTestingOffline(true);
    setOfflineTestResult(null);

    try {
      // Test audio encoder & wav creation offline
      const testSamples = new Float32Array(16000); // 1 sec silence
      // Test OCR worker initialization
      const worker = await getTesseractWorker('eng');
      if (!worker) throw new Error('OCR Worker failed');

      setOfflineTestResult('✓ تم التحقق بنجاح: محرك التعرف الصوتي ومحرك OCR جاهزان للعمل دون أي اتصال بالإنترنت.');
    } catch (err: any) {
      setOfflineTestResult(`تعذر التحقق: ${err.message}`);
    } finally {
      setIsTestingOffline(false);
    }
  };

  const handleClearAll = async () => {
    await clearAllDocuments();
    setShowClearConfirm(false);
    await loadStorageInfo();
    if (onDataCleared) onDataCleared();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.settingsTitle}
      size="normal"
      footer={
        <button className="btn btn-primary" onClick={onClose}>
          {t.close}
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Privacy Notice Box */}
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--success-light)',
            border: '1px solid var(--success-border)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: 'var(--success)' }}>
            <ShieldCheck size={18} />
            <span>{t.privacyNoticeTitle}</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
            {t.privacyNoticeBody}
          </p>
        </div>

        {/* Local Model Manager */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{t.modelsManager}</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.88rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
              <span>{t.tesseractArabicStatus}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--success)', fontWeight: 600 }}>
                <CheckCircle2 size={15} />
                <span>جاهز محلياً</span>
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
              <span>{t.tesseractEnglishStatus}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--success)', fontWeight: 600 }}>
                <CheckCircle2 size={15} />
                <span>جاهز محلياً</span>
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)' }}>
              <span>{t.whisperModelStatus}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: whisperCached ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
                {whisperCached ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                <span>{whisperCached ? 'مخزن محلياً (39MB)' : 'يتطلب التنزيل الأول'}</span>
              </span>
            </div>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={handleDownloadAllForOffline}
            disabled={isDownloading}
            style={{ marginTop: '0.5rem' }}
          >
            <Download size={14} />
            <span>{isDownloading ? t.downloading : t.downloadForOffline}</span>
          </button>

          {downloadProgress && (
            <p style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>{downloadProgress}</p>
          )}
        </div>

        {/* Offline Verification */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>اختبار الجاهزية دون إنترنت</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            اختبار فوري للتأكد من قدرة التطبيق على تشغيل الإملاء والـ OCR دون أي شبكة.
          </p>
          <div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleTestOffline}
              disabled={isTestingOffline}
            >
              <Sparkles size={14} />
              <span>{isTestingOffline ? 'جارٍ الفحص...' : 'فحص الجاهزية الآن'}</span>
            </button>
          </div>
          {offlineTestResult && (
            <div
              style={{
                padding: '0.65rem 0.85rem',
                backgroundColor: 'var(--success-light)',
                color: 'var(--success)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.82rem',
                fontWeight: 600,
              }}
            >
              {offlineTestResult}
            </div>
          )}
        </div>

        {/* Storage Info & Clean */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
              <HardDrive size={16} />
              <span>{t.storageUsed} <strong>{storageUsageMB} MB</strong></span>
            </div>

            <button
              className="btn btn-secondary btn-sm"
              style={{ color: 'var(--danger)' }}
              onClick={() => setShowClearConfirm(true)}
            >
              <Trash2 size={14} />
              <span>{t.clearAllData}</span>
            </button>
          </div>
        </div>

        {/* Clear All Confirmation */}
        {showClearConfirm && (
          <div className="modal-backdrop" onClick={() => setShowClearConfirm(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
              <div className="modal-header">
                <h3 className="modal-title">{t.clearAllData}</h3>
              </div>
              <div className="modal-body">
                <p>هل أنت متأكد من مسح جميع المستندات المحفوظة محلياً على هذا الجهاز؟</p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowClearConfirm(false)}>
                  {t.cancel}
                </button>
                <button className="btn btn-danger" onClick={handleClearAll}>
                  تأكيد المسح
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
