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
  Radio,
  Cpu,
  Trash2,
  Upload,
  Info,
} from 'lucide-react';
import { Modal } from '../layout/Modal';
import { useTranslation } from '../../i18n/useTranslation';
import { LiveSpeechRecognizer } from '../../services/speech/liveSpeechRecognition';
import { AudioRecorder, type RecorderState } from '../../services/speech/audioRecorder';
import { parseVoiceCommand, isDestructiveCommand } from '../../services/speech/voiceCommands';
import { exportTextToTxt } from '../../services/export/txtExporter';
import { generateDocxBlob, downloadBlob } from '../../services/export/docxExporter';
import type { VoiceCommandMatch } from '../../types';

// Whisper is loaded lazily ONLY when the user explicitly presses transcribe
async function loadAndTranscribe(
  audioFloat32: Float32Array,
  langCode: 'ar' | 'en',
  modelName: string,
  onProgress: (msg: string) => void
): Promise<string> {
  onProgress('جارٍ تهيئة نموذج الذكاء الاصطناعي...');
  const { transcribeAudio } = await import('../../services/speech/whisperEngine');
  const result = await transcribeAudio(audioFloat32, langCode, modelName, (p) => {
    onProgress(p.status);
  });
  return result.text;
}

async function loadAndDecodeFile(blob: Blob): Promise<Float32Array> {
  const { decodeAudioFileTo16k } = await import('../../services/speech/whisperEngine');
  const { audioFloat32 } = await decodeAudioFileTo16k(blob);
  return audioFloat32;
}

interface SpeechModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAppendText: (text: string) => void;
  onReplaceText: (text: string) => void;
  onExecuteCommand?: (match: VoiceCommandMatch) => void;
}

export const SpeechModal: React.FC<SpeechModalProps> = ({
  isOpen,
  onClose,
  onAppendText,
  onReplaceText,
  onExecuteCommand,
}) => {
  const { t } = useTranslation();

  // Brave blocks Google Speech API — detect it and default to offline
  const isBraveBrowser = typeof window !== 'undefined' && Boolean(
    (navigator as any).brave && typeof (navigator as any).brave.isBrave === 'function'
  );
  const isLiveSupported = LiveSpeechRecognizer.isSupported() && !isBraveBrowser;

  const [engineMode, setEngineMode] = useState<'live' | 'offline'>(
    isLiveSupported ? 'live' : 'offline'
  );

  const [speechLanguage, setSpeechLanguage] = useState<string>('ar-EG');
  const [whisperModel, setWhisperModel] = useState<string>('onnx-community/whisper-base');
  const [isCommandMode, setIsCommandMode] = useState<boolean>(false);

  // Shared UI state
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [transcriptText, setTranscriptText] = useState<string>('');
  const [interimText, setInterimText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detectedCommand, setDetectedCommand] = useState<VoiceCommandMatch | null>(null);

  // Offline-mode recording state
  const [recorderState, setRecorderState] = useState<RecorderState>({
    isRecording: false,
    isPaused: false,
    durationSeconds: 0,
    volumeLevel: 0,
  });
  // Offline recording is done — audio is ready but NOT transcribed yet
  const [audioReady, setAudioReady] = useState<boolean>(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);

  // Whisper state — only used in offline mode, never triggered automatically
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState<string>('');
  const [whisperWarningShown, setWhisperWarningShown] = useState<boolean>(false);

  // Live mode — simple pulse animation counter (no AudioRecorder in live mode)
  const [livePulse, setLivePulse] = useState<number>(0);
  const livePulseTimerRef = useRef<any>(null);

  // Refs
  const liveRecognizerRef = useRef<LiveSpeechRecognizer | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const audioFloat32Ref = useRef<Float32Array | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Cleanup on modal close
  useEffect(() => {
    if (!isOpen) {
      stopAll();
      setErrorMessage(null);
      setDetectedCommand(null);
      setInterimText('');
    }
  }, [isOpen]);

  // Revoke audio URL on unmount / new recording
  useEffect(() => {
    return () => {
      if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
    };
  }, [recordedAudioUrl]);

  // Animate live pulse dots while in live mode
  useEffect(() => {
    if (isListening && engineMode === 'live') {
      livePulseTimerRef.current = setInterval(() => {
        setLivePulse((p) => (p + 1) % 4);
      }, 500);
    } else {
      clearInterval(livePulseTimerRef.current);
      setLivePulse(0);
    }
    return () => clearInterval(livePulseTimerRef.current);
  }, [isListening, engineMode]);

  // ─── SHARED STOP-ALL ──────────────────────────────────────────────────────
  const stopAll = useCallback(() => {
    if (liveRecognizerRef.current) {
      liveRecognizerRef.current.stop();
      liveRecognizerRef.current = null;
    }
    if (recorderRef.current) {
      recorderRef.current.cancel();
      recorderRef.current = null;
    }
    setIsListening(false);
    setIsPaused(false);
    setRecorderState({ isRecording: false, isPaused: false, durationSeconds: 0, volumeLevel: 0 });
  }, []);

  // ─── LIVE MODE ────────────────────────────────────────────────────────────
  // Live mode uses webkitSpeechRecognition ONLY — no AudioRecorder, no downloads

  const handleStartLive = () => {
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
          // Network error from Google Speech — suggest offline mode but don't auto-download
          setErrorMessage(
            err +
            '\n\n💡 تلميح: يمكنك التبديل لوضع "الذكاء الاصطناعي المحلي" للتسجيل وتفريغه محلياً.'
          );
        }
        setIsListening(false);
      },
      onEnd: () => {
        if (!isPaused) setIsListening(false);
      },
    });

    liveRecognizerRef.current.start(speechLanguage);
    setIsListening(true);
    setIsPaused(false);
  };

  const handlePauseLive = () => {
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

  const handleResumeLive = () => {
    setIsPaused(false);
    handleStartLive();
  };

  const handleStopLive = () => {
    // Just stop — NO auto-transcription, NO downloads
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

  // ─── OFFLINE MODE ─────────────────────────────────────────────────────────
  // Record audio locally → save to memory → user explicitly clicks "Transcribe"

  const handleStartOffline = async () => {
    setErrorMessage(null);
    setDetectedCommand(null);
    setAudioReady(false);
    audioFloat32Ref.current = null;
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
      setRecordedAudioUrl(null);
    }

    try {
      recorderRef.current = new AudioRecorder((state) => setRecorderState(state));
      await recorderRef.current.start();
      setIsListening(true);
      setIsPaused(false);
    } catch (err: any) {
      setErrorMessage(err.message || t.micPermissionError);
    }
  };

  const handlePauseOffline = () => {
    if (recorderRef.current) {
      recorderRef.current.pause();
      setIsPaused(true);
    }
  };

  const handleResumeOffline = () => {
    if (recorderRef.current) {
      recorderRef.current.resume();
      setIsPaused(false);
    }
  };

  const handleStopOffline = async () => {
    // Stop recording — save audio in memory — DO NOT transcribe yet
    if (!recorderRef.current) return;
    try {
      const { audioFloat32, wavBlob, durationSeconds } = await recorderRef.current.stop();
      recorderRef.current = null;

      if (durationSeconds === 0 || audioFloat32.length === 0) {
        setErrorMessage('لم يتم تسجيل أي صوت. تأكد من السماح بالميكروفون والتحدث بوضوح.');
        setIsListening(false);
        setIsPaused(false);
        return;
      }

      audioFloat32Ref.current = audioFloat32;
      const url = URL.createObjectURL(wavBlob);
      if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
      setRecordedAudioUrl(url);
      setAudioReady(true);
      setIsListening(false);
      setIsPaused(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'فشل إيقاف التسجيل');
    }
  };

  // ─── WHISPER TRANSCRIPTION (Explicit user action only) ───────────────────
  const handleTranscribeNow = async () => {
    if (!audioFloat32Ref.current) return;

    // First time: show download warning
    if (!whisperWarningShown) {
      setWhisperWarningShown(true);
      // Warning is shown in UI — user clicks again to confirm
      return;
    }

    await runWhisperTranscription(audioFloat32Ref.current);
  };

  const handleTranscribeConfirmed = async () => {
    if (!audioFloat32Ref.current) return;
    await runWhisperTranscription(audioFloat32Ref.current);
  };

  const runWhisperTranscription = async (float32Data: Float32Array) => {
    setWhisperWarningShown(false);
    try {
      setIsTranscribing(true);
      setTranscriptionProgress('جارٍ التهيئة...');
      const langCode = speechLanguage.startsWith('ar') ? 'ar' : 'en';
      const text = await loadAndTranscribe(float32Data, langCode, whisperModel, (msg) => {
        setTranscriptionProgress(msg);
      });
      setTranscriptText((prev) => (prev ? `${prev.trim()}\n${text}` : text));
      if (isCommandMode) {
        const match = parseVoiceCommand(text);
        if (match) setDetectedCommand(match);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'فشل تحويل الصوت');
    } finally {
      setIsTranscribing(false);
      setTranscriptionProgress('');
    }
  };

  // ─── FILE UPLOAD ──────────────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    setErrorMessage(null);
    if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
    const url = URL.createObjectURL(file);
    setRecordedAudioUrl(url);
    setAudioReady(false); // we'll transcribe from the decoded float32

    try {
      const float32 = await loadAndDecodeFile(file);
      audioFloat32Ref.current = float32;
      setAudioReady(true);
    } catch (err: any) {
      setErrorMessage(`تعذر قراءة الملف الصوتي: ${err.message || err}`);
    }
  };

  // ─── VOICE COMMAND ────────────────────────────────────────────────────────
  const handleExecuteDetectedCommand = () => {
    if (detectedCommand && onExecuteCommand) {
      onExecuteCommand(detectedCommand);
      onClose();
    }
  };

  // ─── EXPORT ───────────────────────────────────────────────────────────────
  const handleApplyAppend = () => {
    const text = interimText ? `${transcriptText} ${interimText}`.trim() : transcriptText.trim();
    if (text) { onAppendText(text); onClose(); }
  };

  const handleApplyReplace = () => {
    const text = interimText ? `${transcriptText} ${interimText}`.trim() : transcriptText.trim();
    if (text) { onReplaceText(text); onClose(); }
  };

  const handleExportTxt = () => exportTextToTxt(transcriptText, 'transcript.txt');

  const handleExportDocx = async () => {
    const blob = await generateDocxBlob({ title: 'Speech Transcript', content: transcriptText });
    downloadBlob(blob, 'transcript.docx');
  };

  // ─── HELPERS ──────────────────────────────────────────────────────────────
  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const volumeBarsCount = 14;
  const activeBars = Math.round(recorderState.volumeLevel * volumeBarsCount);
  const liveDots = '.'.repeat(livePulse + 1).padEnd(3, ' ');

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.speechModalTitle}
      size="large"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {transcriptText && (
              <>
                <button className="btn btn-secondary btn-sm" onClick={handleExportTxt}>
                  <FileDown size={14} /><span>TXT</span>
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleExportDocx}>
                  <FileDown size={14} /><span>Word</span>
                </button>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-secondary" onClick={onClose}>{t.cancel}</button>
            {transcriptText && (
              <>
                <button className="btn btn-secondary" onClick={handleApplyReplace}>{t.replaceEditor}</button>
                <button className="btn btn-primary" onClick={handleApplyAppend}>{t.appendToEditor}</button>
              </>
            )}
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* ── Mode Selector ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          {/* Live */}
          <div
            onClick={() => { stopAll(); setEngineMode('live'); setAudioReady(false); }}
            style={{
              padding: '0.75rem 1rem',
              border: `2px solid ${engineMode === 'live' ? 'var(--primary)' : 'var(--border-light)'}`,
              borderRadius: 'var(--radius-md)',
              backgroundColor: engineMode === 'live' ? 'var(--primary-light)' : 'var(--bg-card)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.65rem',
            }}
          >
            <Radio size={22} style={{ color: engineMode === 'live' ? 'var(--primary)' : 'var(--text-muted)', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: engineMode === 'live' ? 'var(--primary)' : 'inherit' }}>
                إملاء مباشر فوري (Live)
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                يكتب كلمة بكلمة أمامك فوراً — Chrome / Edge فقط — لا يحتاج أي تنزيل
              </div>
            </div>
          </div>

          {/* Offline */}
          <div
            onClick={() => { stopAll(); setEngineMode('offline'); setWhisperWarningShown(false); }}
            style={{
              padding: '0.75rem 1rem',
              border: `2px solid ${engineMode === 'offline' ? 'var(--primary)' : 'var(--border-light)'}`,
              borderRadius: 'var(--radius-md)',
              backgroundColor: engineMode === 'offline' ? 'var(--primary-light)' : 'var(--bg-card)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.65rem',
            }}
          >
            <Cpu size={22} style={{ color: engineMode === 'offline' ? 'var(--primary)' : 'var(--text-muted)', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: engineMode === 'offline' ? 'var(--primary)' : 'inherit' }}>
                تسجيل + تفريغ محلي (AI)
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                سجّل صوتك ثم فرّغه محلياً — يتطلب تحميل نموذج ذكاء اصطناعي مرة واحدة
              </div>
            </div>
          </div>
        </div>

        {/* ── Brave Notice ── */}
        {isBraveBrowser && (
          <div style={{ padding: '0.65rem 0.85rem', backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-sm)', fontSize: '0.84rem', display: 'flex', gap: '0.5rem' }}>
            <span>🦁</span>
            <span>متصفح <strong>Brave</strong> يحظر خدمة Google الصوتية. استخدم وضع <strong>"تسجيل + تفريغ محلي"</strong>.</span>
          </div>
        )}

        {/* ── Language + Options Row ── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>اللغة / اللهجة:</label>
            <select
              className="search-input"
              style={{ width: 'auto', padding: '0.35rem 0.75rem', fontWeight: 600 }}
              value={speechLanguage}
              onChange={(e) => { setSpeechLanguage(e.target.value); if (isListening && engineMode === 'live') handleStopLive(); }}
            >
              <option value="ar-EG">العربية - مصر (المصرية والفصحى)</option>
              <option value="ar-SA">العربية - السعودية والخليج</option>
              <option value="ar">العربية - فصحى</option>
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
            </select>

            {engineMode === 'offline' && (
              <>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, marginRight: '0.25rem' }}>النموذج:</label>
                <select
                  className="search-input"
                  style={{ width: 'auto', padding: '0.35rem 0.75rem', fontWeight: 600 }}
                  value={whisperModel}
                  onChange={(e) => setWhisperModel(e.target.value)}
                >
                  <option value="onnx-community/whisper-base">Base — دقة عالية (~74 MB، مرة واحدة فقط)</option>
                  <option value="onnx-community/whisper-tiny">Tiny — سريع خفيف (~39 MB، مرة واحدة فقط)</option>
                </select>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.88rem' }}>
              <input type="checkbox" checked={isCommandMode} onChange={(e) => setIsCommandMode(e.target.checked)} />
              <Command size={14} />
              <span>{t.voiceCommandMode}</span>
            </label>

            {/* File upload — triggers Whisper lazily too */}
            <input type="file" ref={fileInputRef} accept="audio/*" style={{ display: 'none' }} onChange={handleFileUpload} />
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setEngineMode('offline'); fileInputRef.current?.click(); }}
              title="رفع ملف صوتي مسجّل للتفريغ"
              disabled={isListening || isTranscribing}
            >
              <Upload size={14} /><span>رفع ملف صوتي</span>
            </button>
          </div>
        </div>

        {isCommandMode && (
          <div style={{ padding: '0.6rem 0.85rem', backgroundColor: 'var(--primary-light)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--primary)' }}>
            {t.voiceCommandHint}
          </div>
        )}

        {/* ── Recording / Listening Box ── */}
        <div
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
            padding: '1.25rem',
            backgroundColor: isListening ? 'rgba(79,70,229,0.04)' : 'var(--bg-muted)',
            borderRadius: 'var(--radius-lg)',
            border: `2px solid ${isListening ? 'var(--primary)' : 'var(--border-light)'}`,
            transition: 'all 0.2s ease',
          }}
        >
          {/* Status text */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.95rem', fontWeight: 700 }}>
            {isListening ? (
              <>
                <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', backgroundColor: 'var(--danger)', boxShadow: '0 0 10px var(--danger)', animation: 'pulse 1.2s infinite' }} />
                <span style={{ color: 'var(--danger)' }}>
                  {engineMode === 'live'
                    ? `يستمع ويكتب${liveDots}`
                    : `جارٍ التسجيل${liveDots} (${formatSeconds(recorderState.durationSeconds)})`}
                </span>
              </>
            ) : isPaused ? (
              <span style={{ color: 'var(--warning)' }}>⏸️ متوقف مؤقتاً — عدّل النص ثم استأنف</span>
            ) : audioReady ? (
              <span style={{ color: 'var(--success)', fontWeight: 700 }}>✅ التسجيل جاهز — اضغط "فرّغ الصوت" لتحويله لنص</span>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>
                {engineMode === 'live'
                  ? 'اضغط "ابدأ الإملاء" وتحدث — الكلمات ستظهر هنا فوراً'
                  : 'اضغط "ابدأ التسجيل" ثم "إنهاء" ثم "فرّغ الصوت"'}
              </span>
            )}
          </div>

          {/* Volume bars — offline mode only (real microphone data) */}
          {engineMode === 'offline' && isListening && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', width: '100%', maxWidth: '360px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '4px', height: '36px', width: '100%' }}>
                {Array.from({ length: volumeBarsCount }).map((_, idx) => {
                  const active = idx < activeBars;
                  const h = active ? Math.max(10, Math.min(34, Math.round(recorderState.volumeLevel * 36 * (1 + (idx % 3) * 0.15)))) : 5;
                  return (
                    <div key={idx} style={{
                      width: '7px', height: `${h}px`, borderRadius: '3px',
                      backgroundColor: active ? (idx > 9 ? 'var(--danger)' : idx > 6 ? 'var(--warning)' : 'var(--success)') : 'rgba(150,150,150,0.25)',
                      transition: 'height 0.07s ease',
                    }} />
                  );
                })}
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                مستوى الصوت: {Math.round(recorderState.volumeLevel * 100)}%
                {recorderState.volumeLevel < 0.02 && recorderState.durationSeconds > 3 && (
                  <strong style={{ color: 'var(--danger)', marginRight: 6 }}> — صوت خافت جداً أو الميكروفون مكتوم</strong>
                )}
              </span>
            </div>
          )}

          {/* Live mode: simple pulsing animation (no extra mic stream) */}
          {engineMode === 'live' && isListening && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {[0.6, 1.0, 0.7, 1.0, 0.5].map((scale, i) => (
                <div key={i} style={{
                  width: 8, height: `${Math.round(20 * scale + (livePulse === i % 4 ? 10 : 0))}px`,
                  backgroundColor: 'var(--primary)', borderRadius: 4,
                  transition: 'height 0.4s ease',
                  opacity: 0.6 + (livePulse === i % 4 ? 0.4 : 0),
                }} />
              ))}
            </div>
          )}

          {/* Audio player (offline — after recording done) */}
          {recordedAudioUrl && !isListening && engineMode === 'offline' && (
            <div style={{ width: '100%', maxWidth: '420px' }}>
              <audio controls src={recordedAudioUrl} style={{ width: '100%', height: 36 }} />
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            {engineMode === 'live' ? (
              !isListening ? (
                isPaused ? (
                  <>
                    <button className="btn btn-primary" onClick={handleResumeLive} style={{ padding: '0.75rem 1.75rem', fontSize: '1rem' }}>
                      <Play size={18} /><span>استئناف</span>
                    </button>
                    <button className="btn btn-secondary" onClick={handleStopLive}>
                      <Square size={16} /><span>إنهاء</span>
                    </button>
                  </>
                ) : (
                  <button className="btn btn-primary" onClick={handleStartLive} style={{ padding: '0.85rem 2rem', fontSize: '1.05rem', fontWeight: 700 }}>
                    <Mic size={22} /><span>ابدأ الإملاء المباشر</span>
                  </button>
                )
              ) : (
                <>
                  <button className="btn btn-secondary" onClick={handlePauseLive} style={{ padding: '0.75rem 1.5rem', fontWeight: 700 }}>
                    <Pause size={18} style={{ color: 'var(--warning)' }} /><span>إيقاف مؤقت لتعديل</span>
                  </button>
                  <button className="btn btn-danger" onClick={handleStopLive} style={{ padding: '0.75rem 1.75rem' }}>
                    <Square size={18} /><span>إنهاء الإملاء</span>
                  </button>
                </>
              )
            ) : (
              // ── Offline buttons ──
              !recorderState.isRecording ? (
                !audioReady ? (
                  <button
                    className="btn btn-primary"
                    onClick={handleStartOffline}
                    disabled={isTranscribing}
                    style={{ padding: '0.85rem 2rem', fontSize: '1.05rem', fontWeight: 700 }}
                  >
                    <Mic size={22} /><span>ابدأ التسجيل الصوتي</span>
                  </button>
                ) : null
              ) : (
                <>
                  {recorderState.isPaused ? (
                    <button className="btn btn-secondary" onClick={handleResumeOffline}>
                      <Play size={18} /><span>استئناف التسجيل</span>
                    </button>
                  ) : (
                    <button className="btn btn-secondary" onClick={handlePauseOffline}>
                      <Pause size={18} /><span>إيقاف مؤقت</span>
                    </button>
                  )}
                  <button className="btn btn-danger" onClick={handleStopOffline} style={{ padding: '0.75rem 1.75rem' }}>
                    <Square size={18} /><span>إنهاء التسجيل</span>
                  </button>
                </>
              )
            )}
          </div>

          {/* ── Whisper Transcribe button — shows ONLY after recording done, explicit action ── */}
          {engineMode === 'offline' && audioReady && !isListening && !isTranscribing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', maxWidth: '440px' }}>
              {/* First click: show download warning */}
              {!whisperWarningShown ? (
                <button
                  className="btn btn-primary"
                  onClick={handleTranscribeNow}
                  style={{ padding: '0.65rem 1rem', fontWeight: 700, width: '100%' }}
                >
                  <Sparkles size={16} /><span>🔤 فرّغ الصوت إلى نص الآن</span>
                </button>
              ) : (
                <div style={{ padding: '0.85rem', border: '1px solid var(--warning)', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(245,158,11,0.08)' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '0.65rem' }}>
                    <Info size={18} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 2 }} />
                    <div style={{ fontSize: '0.88rem' }}>
                      <strong>تحميل لمرة واحدة:</strong> سيقوم المتصفح بتنزيل نموذج الذكاء الاصطناعي ({whisperModel.includes('base') ? '~74 MB' : '~39 MB'}) وتخزينه محلياً. في المرات القادمة سيعمل فوراً بدون إنترنت.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setWhisperWarningShown(false)}>إلغاء</button>
                    <button className="btn btn-primary btn-sm" onClick={handleTranscribeConfirmed}>
                      <Sparkles size={14} /><span>تأكيد — حمّل وفرّغ</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Re-record button */}
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setAudioReady(false); audioFloat32Ref.current = null; if (recordedAudioUrl) { URL.revokeObjectURL(recordedAudioUrl); setRecordedAudioUrl(null); } setWhisperWarningShown(false); }}
                style={{ width: '100%' }}
              >
                <Mic size={14} /><span>تسجيل من جديد</span>
              </button>
            </div>
          )}

          {/* Whisper progress */}
          {isTranscribing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--primary)', fontSize: '0.92rem', fontWeight: 600 }}>
              <Sparkles size={18} />
              <span>{transcriptionProgress || t.transcribing}</span>
            </div>
          )}

          {/* Error */}
          {errorMessage && (
            <div style={{
              width: '100%', maxWidth: '520px',
              padding: '0.75rem 1rem',
              backgroundColor: 'rgba(239,68,68,0.07)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--danger)', fontSize: '0.88rem',
              display: 'flex', gap: '0.5rem', alignItems: 'flex-start',
              whiteSpace: 'pre-line',
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* ── Detected Command ── */}
        {detectedCommand && (
          <div style={{
            padding: '1rem',
            backgroundColor: isDestructiveCommand(detectedCommand.command) ? 'var(--danger-light)' : 'var(--success-light)',
            border: `1px solid ${isDestructiveCommand(detectedCommand.command) ? 'var(--danger-border)' : 'var(--success-border)'}`,
            borderRadius: 'var(--radius-md)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontWeight: 700 }}>{t.commandDetected} <strong>"{detectedCommand.phrase}"</strong></div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {isDestructiveCommand(detectedCommand.command) ? 'أمر حساس — تأكد قبل التنفيذ.' : 'يمكنك تأكيد تنفيذ الأمر.'}
              </div>
            </div>
            <button
              className={`btn ${isDestructiveCommand(detectedCommand.command) ? 'btn-danger' : 'btn-success'} btn-sm`}
              onClick={handleExecuteDetectedCommand}
            >
              {t.apply}
            </button>
          </div>
        )}

        {/* ── Live Interim words ── */}
        {isListening && engineMode === 'live' && (
          <div style={{
            padding: '0.75rem 1rem',
            backgroundColor: interimText ? 'rgba(79,70,229,0.08)' : 'var(--bg-muted)',
            border: `1px dashed ${interimText ? 'var(--primary)' : 'var(--border-light)'}`,
            borderRadius: 'var(--radius-md)',
            fontSize: '1.05rem',
            color: interimText ? 'var(--primary)' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: '0.65rem', minHeight: 44,
          }}>
            <Sparkles size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <span>
              {interimText
                ? <strong>{interimText}</strong>
                : 'تحدث الآن — الكلمات ستظهر هنا فوراً قبل حفظها'}
            </span>
          </div>
        )}

        {/* ── Editable transcript box ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '0.92rem', fontWeight: 700 }}>
              {t.transcriptionResult} (قابل للتعديل المباشر):
            </label>
            {transcriptText && (
              <button
                className="btn btn-secondary btn-icon"
                onClick={() => { setTranscriptText(''); setInterimText(''); }}
                style={{ padding: '2px 8px', fontSize: '0.75rem', color: 'var(--danger)' }}
              >
                <Trash2 size={13} /><span>مسح</span>
              </button>
            )}
          </div>
          <textarea
            className="editor-textarea"
            style={{
              minHeight: 180,
              border: isPaused ? '2px solid var(--warning)' : '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
              fontSize: '1.05rem', lineHeight: 1.8,
            }}
            value={transcriptText}
            onChange={(e) => setTranscriptText(e.target.value)}
            placeholder={
              engineMode === 'live'
                ? 'سيظهر الكلام هنا تلقائياً كلمة بكلمة أثناء حديثك...'
                : 'بعد التسجيل واختيار "فرّغ الصوت" سيظهر النص هنا للتعديل...'
            }
          />
        </div>

      </div>
    </Modal>
  );
};
