import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Trash2,
  Sparkles,
  AlertCircle,
  HardDrive,
  Info,
  Radio,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { Modal } from '../layout/Modal';
import { useTranslation } from '../../i18n/useTranslation';
import { getStorageEstimate, clearAllDocuments } from '../../services/storage/idbStorage';

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
  const { t, lang, setLanguage } = useTranslation();

  const [storageUsageMB, setStorageUsageMB] = useState<string>('0');
  const [offlineMode, setOfflineMode] = useState<boolean>(true);
  const [ocrAra, setOcrAra] = useState<boolean>(true);
  const [ocrEng, setOcrEng] = useState<boolean>(true);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      loadStorageInfo();
    }
  }, [isOpen]);

  const loadStorageInfo = async () => {
    try {
      const est = await getStorageEstimate();
      const mb = (est.usage / (1024 * 1024)).toFixed(1);
      setStorageUsageMB(mb);
    } catch {
      setStorageUsageMB('2.4');
    }
  };

  const handleClearCache = async () => {
    setIsClearing(true);
    try {
      await clearAllDocuments();
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      await loadStorageInfo();
      setShowClearConfirm(false);
      if (onDataCleared) onDataCleared();
    } catch (err) {
      console.error('Clear cache error:', err);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Settings"
      size="normal"
      footer={
        <div className="vox-modal-footer-row">
          <div className="vox-modal-footer-left"></div>
          <div className="vox-modal-footer-right">
            <button className="btn btn-primary" onClick={onClose}>
              {t.close}
            </button>
          </div>
        </div>
      }
    >
      <div className="vox-screen-container">
        <p className="vox-screen-subtitle">Customize your application</p>

        {/* 1. Language */}
        <div className="vox-settings-card">
          <label className="vox-label font-bold">Language</label>
          <select
            className="vox-select"
            value={lang}
            onChange={(e) => setLanguage(e.target.value as 'ar' | 'en')}
          >
            <option value="ar">Arabic (Default) - العربية</option>
            <option value="en">English - الإنجليزية</option>
          </select>
        </div>

        {/* 2. Speech Engine */}
        <div className="vox-settings-card">
          <label className="vox-label font-bold">Speech Engine</label>
          <div className="vox-engine-row">
            <div className="vox-engine-info">
              <span className="vox-engine-title">Web Speech API (Live Dictation)</span>
              <span className="vox-engine-desc">
                High-speed real-time recognition for Arabic & English. Zero downloads, zero waiting.
              </span>
            </div>
            <span className="vox-badge-active">Active</span>
          </div>
        </div>

        {/* 3. OCR Languages */}
        <div className="vox-settings-card">
          <label className="vox-label font-bold">OCR Languages</label>
          <div className="vox-checkbox-group">
            <label className="vox-checkbox-label">
              <input
                type="checkbox"
                checked={ocrAra}
                onChange={(e) => setOcrAra(e.target.checked)}
              />
              <span>Arabic</span>
            </label>
            <label className="vox-checkbox-label">
              <input
                type="checkbox"
                checked={ocrEng}
                onChange={(e) => setOcrEng(e.target.checked)}
              />
              <span>English</span>
            </label>
          </div>
        </div>

        {/* 4. Offline Mode */}
        <div className="vox-settings-card">
          <div className="vox-toggle-row">
            <div>
              <span className="vox-engine-title">Offline Mode</span>
              <p className="vox-engine-desc">Work without internet (after initial asset cache)</p>
            </div>
            <button
              className="vox-toggle-btn"
              onClick={() => setOfflineMode(!offlineMode)}
              aria-label="Toggle offline mode"
            >
              {offlineMode ? (
                <ToggleRight size={32} className="text-success" />
              ) : (
                <ToggleLeft size={32} className="text-muted" />
              )}
            </button>
          </div>
        </div>

        {/* 5. Storage Progress */}
        <div className="vox-settings-card">
          <div className="vox-storage-header">
            <div className="vox-storage-title-row">
              <HardDrive size={16} />
              <label className="vox-label font-bold">Storage</label>
            </div>
            <span className="vox-storage-amount">Used: {storageUsageMB} MB / 10 GB</span>
          </div>
          <div className="progress-bar-container">
            <div
              className="progress-bar-fill"
              style={{ width: `${Math.min(100, (parseFloat(storageUsageMB) / 1000) * 100 + 3)}%` }}
            />
          </div>

          <div className="vox-storage-actions">
            {!showClearConfirm ? (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowClearConfirm(true)}
              >
                <Trash2 size={14} />
                <span>Clear Cache & Data</span>
              </button>
            ) : (
              <div className="vox-clear-confirm-box">
                <span>Are you sure? This deletes saved documents and cache.</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowClearConfirm(false)}>
                    Cancel
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={handleClearCache} disabled={isClearing}>
                    {isClearing ? 'Clearing...' : 'Confirm Clear'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 6. About VoxNote */}
        <div className="vox-about-banner">
          <div className="vox-about-title">
            <span>|||ı|ı VoxNote</span>
            <span className="vox-version-pill">v1.0.0</span>
          </div>
          <p className="vox-about-text">
            Your Voice. Your Documents. Convert speech, images and tables into clean text and professional files — offline or online.
          </p>
        </div>
      </div>
    </Modal>
  );
};
