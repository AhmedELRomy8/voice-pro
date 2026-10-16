import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  Square,
  Pause,
  Play,
  FileDown,
  AlertCircle,
  Sparkles,
  Command,
  Trash2,
  Copy,
  Check,
  Radio,
  FileText
} from 'lucide-react';
import { Modal } from '../layout/Modal';
import { useTranslation } from '../../i18n/useTranslation';
import { LiveSpeechRecognizer } from '../../services/speech/liveSpeechRecognition';
import { parseVoiceCommand, isDestructiveCommand } from '../../services/speech/voiceCommands';
import { exportTextToTxt } from '../../services/export/txtExporter';
import { generateDocxBlob, downloadBlob } from '../../services/export/docxExporter';
import type { VoiceCommandMatch } from '../../types';

interface SpeechModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAppendText: (text: string) => void;
  onReplaceText: (text: string) => void;
  onExecuteCommand?: (match: VoiceCommandMatch) => void;
  isPageView?: boolean;
}

export const SpeechModal: React.FC<SpeechModalProps> = ({
  isOpen,
  onClose,
  onAppendText,
  onReplaceText,
  onExecuteCommand,
  isPageView = false,
}) => {
  const { t, lang } = useTranslation();

  const [speechLanguage, setSpeechLanguage] = useState<string>('ar-EG');
  const [isCommandMode, setIsCommandMode] = useState<boolean>(false);

  const [isListening, setIsListening] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [transcriptText, setTranscriptText] = useState<string>('');
  const [interimText, setInterimText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detectedCommand, setDetectedCommand] = useState<VoiceCommandMatch | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [durationSeconds, setDurationSeconds] = useState<number>(0);

  const liveRecognizerRef = useRef<LiveSpeechRecognizer | null>(null);
  const timerIntervalRef = useRef<any>(null);
  const isPausedRef = useRef<boolean>(false);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Clean up on modal close
  useEffect(() => {
    if (!isOpen) {
      handleStop();
      setErrorMessage(null);
      setDetectedCommand(null);
      setInterimText('');
      setDurationSeconds(0);
    }
  }, [isOpen]);

  // Timer while listening
  useEffect(() => {
    if (isListening && !isPaused) {
      timerIntervalRef.current = setInterval(() => {
        setDurationSeconds((s) => s + 1);
      }, 1000);
    } else {
      clearInterval(timerIntervalRef.current);
    }
    return () => clearInterval(timerIntervalRef.current);
  }, [isListening, isPaused]);

  const handleStart = () => {
    setErrorMessage(null);
    setDetectedCommand(null);
    setInterimText('');

    liveRecognizerRef.current = new LiveSpeechRecognizer({
      onInterimResult: (text) => {
        setInterimText(text);
        if (isCommandMode && text) {
          const match = parseVoiceCommand(text);
          if (match) setDetectedCommand(match);
        }
      },
      onFinalResult: (text) => {
        setTranscriptText((prev) => {
          const updated = prev ? `${prev.trim()} ${text.trim()}` : text.trim();
          return updated;
        });
        setInterimText('');
        if (isCommandMode) {
          const match = parseVoiceCommand(text);
          if (match) setDetectedCommand(match);
        }
      },
      onError: (err, isNetErr) => {
        setErrorMessage(err);
        if (isNetErr) {
          setErrorMessage(
            err + '\n\nتلميح: تأكد من اتصال الإنترنت وأن متصفحك يسمح بالاتصال بخدمة التعرف الصوتي.'
          );
        }
        setIsListening(false);
      },
      onEnd: () => {
        if (!isPausedRef.current) {
          setIsListening(false);
        }
      },
    });

    liveRecognizerRef.current.start(speechLanguage);
    setIsListening(true);
    setIsPaused(false);
  };

  const handlePause = () => {
    if (liveRecognizerRef.current) {
      liveRecognizerRef.current.stop();
      liveRecognizerRef.current = null;
    }
    if (interimText) {
      setTranscriptText((prev) =>
        prev ? `${prev.trim()} ${interimText.trim()}` : interimText.trim()
      );
      setInterimText('');
    }
    setIsListening(false);
    setIsPaused(true);
  };

  const handleResume = () => {
    setIsPaused(false);
    handleStart();
  };

  const handleStop = () => {
    if (liveRecognizerRef.current) {
      liveRecognizerRef.current.stop();
      liveRecognizerRef.current = null;
    }
    if (interimText) {
      setTranscriptText((prev) =>
        prev ? `${prev.trim()} ${interimText.trim()}` : interimText.trim()
      );
      setInterimText('');
    }
    setIsListening(false);
    setIsPaused(false);
  };

  const handleClear = () => {
    setTranscriptText('');
    setInterimText('');
    setDurationSeconds(0);
    setDetectedCommand(null);
  };

  const handleCopy = () => {
    const full = transcriptText + (interimText ? ` ${interimText}` : '');
    if (full) {
      navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExportTxt = () => {
    const full = transcriptText + (interimText ? ` ${interimText}` : '');
    exportTextToTxt(full, 'voxnote_transcript.txt');
  };

  const handleExportDocx = async () => {
    const full = transcriptText + (interimText ? ` ${interimText}` : '');
    const blob = await generateDocxBlob({ title: 'VoxNote Speech Transcript', content: full });
    downloadBlob(blob, 'voxnote_transcript.docx');
  };

  const handleApplyAppend = () => {
    const full = transcriptText + (interimText ? ` ${interimText}` : '');
    if (full.trim()) {
      onAppendText(full.trim());
      onClose();
    }
  };

  const handleApplyReplace = () => {
    const full = transcriptText + (interimText ? ` ${interimText}` : '');
    if (full.trim()) {
      onReplaceText(full.trim());
      onClose();
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const footerContent = (
    <div className="vox-modal-footer-row">
      <div className="vox-modal-footer-left">
        <button className="btn btn-secondary btn-sm" onClick={handleClear} disabled={!transcriptText && !interimText}>
          <Trash2 size={14} /><span>{lang === 'ar' ? 'مسح الكل' : 'Clear'}</span>
        </button>
        <button className="btn btn-secondary btn-sm" onClick={handleExportTxt} disabled={!transcriptText && !interimText}>
          <FileDown size={14} /><span>TXT</span>
        </button>
        <button className="btn btn-secondary btn-sm" onClick={handleExportDocx} disabled={!transcriptText && !interimText}>
          <FileDown size={14} /><span>Word</span>
        </button>
      </div>
      <div className="vox-modal-footer-right">
        <button className="btn btn-secondary" onClick={onClose}>{lang === 'ar' ? 'رجوع' : 'Back'}</button>
        {(transcriptText || interimText) && (
          <>
            <button className="btn btn-secondary" onClick={handleApplyReplace}>{lang === 'ar' ? 'استبدال في المحرر' : 'Replace'}</button>
            <button className="btn btn-primary" onClick={handleApplyAppend}>{lang === 'ar' ? 'إلحاق بالمحرر' : 'Append'}</button>
          </>
        )}
      </div>
    </div>
  );

  const mainBody = (
    <div className="vox-stt-container">
      {/* Subtitle */}
      {!isPageView && <p className="vox-stt-subtitle">Speak clearly and get accurate text.</p>}

      {/* Language & Command mode row */}
      <div className="vox-stt-options-row">
        <div className="vox-stt-lang-group">
          <label className="vox-label">{lang === 'ar' ? 'لغة التحدث:' : 'Language:'}</label>
          <select
            className="vox-select"
            value={speechLanguage}
            onChange={(e) => {
              setSpeechLanguage(e.target.value);
              if (isListening) handleStop();
            }}
          >
            <option value="ar-EG">عربي (مصري) - Egyptian Arabic</option>
            <option value="ar-SA">عربي (خليجي/سعودي) - Gulf Arabic</option>
            <option value="ar">عربي فصيح - Modern Standard Arabic</option>
            <option value="en-US">English (US)</option>
            <option value="en-GB">English (UK)</option>
          </select>
        </div>

        <label className="vox-checkbox-label">
          <input
            type="checkbox"
            checked={isCommandMode}
            onChange={(e) => setIsCommandMode(e.target.checked)}
          />
          <Command size={14} />
          <span>{t.voiceCommandMode}</span>
        </label>
      </div>

      {/* Voice command banner */}
      {isCommandMode && (
        <div className="vox-command-info-banner">
          <Sparkles size={16} />
          <span>{t.voiceCommandHint}</span>
        </div>
      )}

      {/* Central Record Circle with Waves and Timer */}
      <div className="vox-stt-record-card">
        <div className={`vox-mic-circle-wrapper ${isListening ? 'listening-active' : ''}`}>
          <button
            className={`vox-mic-circle ${isListening ? 'pulse' : ''}`}
            onClick={isListening ? handleStop : isPaused ? handleResume : handleStart}
            aria-label={isListening ? 'Stop recording' : 'Start recording'}
          >
            <Mic size={36} color="#ffffff" />
          </button>
          {isListening && (
            <>
              <div className="wave-ring ring-1"></div>
              <div className="wave-ring ring-2"></div>
              <div className="wave-ring ring-3"></div>
            </>
          )}
        </div>

        <div className="vox-stt-status-text">
          {isListening ? (
            <span className="text-danger font-bold">
              {lang === 'ar' ? '● يستمع ويكتب الآن...' : '● Listening & Typing live...'}
            </span>
          ) : isPaused ? (
            <span className="text-warning font-bold">
              {lang === 'ar' ? 'متوقف مؤقتاً — تعديل أو استئناف' : 'Paused - Edit or resume'}
            </span>
          ) : (
            <span className="text-muted">
              {lang === 'ar' ? 'جاهز للتسجيل' : 'Ready to record'}
            </span>
          )}
        </div>

        {/* Soundwave + Timer */}
        <div className="vox-stt-timer-row">
          <div className="mini-soundwave left">
            <span></span><span></span><span></span><span></span>
          </div>
          <span className="vox-timer-digits">{formatTimer(durationSeconds)}</span>
          <div className="mini-soundwave right">
            <span></span><span></span><span></span><span></span>
          </div>
        </div>

        {/* Action buttons row: Start / Pause / Stop */}
        <div className="vox-stt-controls-row">
          {!isListening ? (
            isPaused ? (
              <>
                <button className="vox-btn-pill btn-start" onClick={handleResume}>
                  <Play size={16} /><span>{lang === 'ar' ? 'استئناف' : 'Resume'}</span>
                </button>
                <button className="vox-btn-pill btn-stop" onClick={handleStop}>
                  <Square size={16} /><span>{lang === 'ar' ? 'إيقاف' : 'Stop'}</span>
                </button>
              </>
            ) : (
              <button className="vox-btn-pill btn-start" onClick={handleStart}>
                <Play size={16} /><span>{lang === 'ar' ? 'ابدأ التسجيل' : 'Start'}</span>
              </button>
            )
          ) : (
            <>
              <button className="vox-btn-pill btn-pause" onClick={handlePause}>
                <Pause size={16} /><span>{lang === 'ar' ? 'إيقاف مؤقت' : 'Pause'}</span>
              </button>
              <button className="vox-btn-pill btn-stop" onClick={handleStop}>
                <Square size={16} /><span>{lang === 'ar' ? 'إيقاف' : 'Stop'}</span>
              </button>
            </>
          )}
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="vox-error-box">
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Live Interim Streaming Words */}
      {isListening && (
        <div className="vox-interim-box">
          <Sparkles size={16} className="text-primary" />
          <span className="vox-interim-text">
            {interimText || (lang === 'ar' ? 'تحدث الآن — الكلمات تظهر هنا فوراً...' : 'Speak now — words appear here in real time...')}
          </span>
        </div>
      )}

      {/* Detected Voice Command */}
      {detectedCommand && (
        <div className="vox-detected-command-row">
          <div>
            <strong>{lang === 'ar' ? `تم اكتشاف أمر: "${detectedCommand.phrase}"` : `Command detected: "${detectedCommand.phrase}"`}</strong>
          </div>
          {onExecuteCommand && (
            <button
              className="btn btn-success btn-sm"
              onClick={() => {
                onExecuteCommand(detectedCommand);
                onClose();
              }}
            >
              {lang === 'ar' ? 'تنفيذ' : 'Execute'}
            </button>
          )}
        </div>
      )}

      {/* Transcription Output Box */}
      <div className="vox-transcription-section">
        <div className="vox-transcription-header">
          <label className="vox-label">{lang === 'ar' ? 'النص المحوّل' : 'Transcription'}</label>
          <div className="vox-transcription-tools">
            <button
              className="vox-tool-btn"
              onClick={handleCopy}
              disabled={!transcriptText && !interimText}
              title={lang === 'ar' ? 'نسخ إلى الحافظة' : 'Copy to clipboard'}
            >
              {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
              <span>{copied ? (lang === 'ar' ? 'تم النسخ' : 'Copied') : (lang === 'ar' ? 'نسخ' : 'Copy')}</span>
            </button>
          </div>
        </div>

        <textarea
          className="vox-transcription-textarea"
          placeholder={lang === 'ar' ? 'النص المحوّل سيظهر هنا...' : 'Your transcribed text will appear here...'}
          value={transcriptText + (interimText ? ` ${interimText}` : '')}
          onChange={(e) => setTranscriptText(e.target.value)}
          rows={6}
          dir={speechLanguage.startsWith('ar') ? 'rtl' : 'ltr'}
        />
      </div>
    </div>
  );

  if (isPageView) {
    return (
      <div className="vox-page-view-card">
        <div className="vox-page-view-header">
          <div className="vox-page-view-title-wrap">
            <h2 className="vox-page-view-title">
              {lang === 'ar' ? 'تحويل الصوت إلى نص' : 'Speech to Text'}
            </h2>
            <p className="vox-page-view-sub">
              {lang === 'ar' ? 'تحدث بوضوح واحصل على النص العربي أو الإنجليزي بدقة فائقة' : 'Speak clearly and get accurate text in real-time'}
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            {lang === 'ar' ? 'الرئيسية' : 'Home'}
          </button>
        </div>
        {mainBody}
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
          {footerContent}
        </div>
      </div>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Speech to Text"
      size="large"
      footer={footerContent}
    >
      {mainBody}
    </Modal>
  );
};
