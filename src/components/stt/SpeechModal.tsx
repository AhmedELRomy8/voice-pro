import React, { useState, useEffect, useRef } from 'react';
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
  Volume2
} from 'lucide-react';
import { Modal } from '../layout/Modal';
import { useTranslation } from '../../i18n/useTranslation';
import { LiveSpeechRecognizer } from '../../services/speech/liveSpeechRecognition';
import { AudioRecorder, type RecorderState } from '../../services/speech/audioRecorder';
import { transcribeAudio, decodeAudioFileTo16k, type WhisperProgress } from '../../services/speech/whisperEngine';
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
}

export const SpeechModal: React.FC<SpeechModalProps> = ({
  isOpen,
  onClose,
  onAppendText,
  onReplaceText,
  onExecuteCommand,
}) => {
  const { t } = useTranslation();

  // Detect Brave browser (which blocks Google Speech API by default)
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
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [transcriptText, setTranscriptText] = useState<string>('');
  const [interimText, setInterimText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isNetworkError, setIsNetworkError] = useState<boolean>(false);
  const [detectedCommand, setDetectedCommand] = useState<VoiceCommandMatch | null>(null);

  // Audio recording & volume meter state (active in BOTH modes for visual feedback)
  const [recorderState, setRecorderState] = useState<RecorderState>({
    isRecording: false,
    isPaused: false,
    durationSeconds: 0,
    volumeLevel: 0,
  });
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState<string>('');
  const [recordedWavBlob, setRecordedWavBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);

  const liveRecognizerRef = useRef<LiveSpeechRecognizer | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const audioFloat32Ref = useRef<Float32Array | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      handleStopAll();
      setErrorMessage(null);
      setIsNetworkError(false);
      setDetectedCommand(null);
      setInterimText('');
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
        setRecordedAudioUrl(null);
      }
    }
  }, [isOpen]);

  // Clean up object URL when a new blob is recorded
  useEffect(() => {
    if (recordedWavBlob) {
      const url = URL.createObjectURL(recordedWavBlob);
      setRecordedAudioUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setRecordedAudioUrl(null);
    }
  }, [recordedWavBlob]);

  const handleStopAll = () => {
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
    setRecorderState({
      isRecording: false,
      isPaused: false,
      durationSeconds: 0,
      volumeLevel: 0,
    });
  };

  // --- LIVE ENGINE HANDLERS ---
  const handleStartLive = async () => {
    setErrorMessage(null);
    setIsNetworkError(false);
    setDetectedCommand(null);
    setInterimText('');

    // 1. Start audio recorder monitor simultaneously so user sees volume waves and has backup audio
    try {
      recorderRef.current = new AudioRecorder((state) => {
        setRecorderState(state);
      });
      await recorderRef.current.start();
    } catch (e: any) {
      console.warn('Microphone audio monitor note:', e);
    }

    // 2. Start streaming recognition
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
          if (isCommandMode) {
            const match = parseVoiceCommand(text);
            if (match) setDetectedCommand(match);
          }
          return updated;
        });
        setInterimText('');
      },
      onError: (err, isNetErr) => {
        setErrorMessage(err);
        if (isNetErr) {
          setIsNetworkError(true);
        }
        setIsListening(false);
      },
      onEnd: () => {
        if (!isPaused) {
          setIsListening(false);
        }
      },
    });

    liveRecognizerRef.current.start(speechLanguage);
    setIsListening(true);
    setIsPaused(false);
  };

  const handlePauseLive = () => {
    if (liveRecognizerRef.current) {
      liveRecognizerRef.current.stop();
    }
    if (recorderRef.current) {
      recorderRef.current.pause();
    }
    // Commit any interim text to the transcript box so it can be edited immediately
    if (interimText) {
      setTranscriptText((prev) => (prev ? `${prev.trim()} ${interimText.trim()}` : interimText.trim()));
      setInterimText('');
    }
    setIsListening(false);
    setIsPaused(true);
  };

  const handleResumeLive = () => {
    handleStartLive();
  };

  const handleStopLive = async () => {
    handlePauseLive();
    setIsPaused(false);
    // Finalize recording for possible backup / playback
    if (recorderRef.current) {
      try {
        const { audioFloat32, wavBlob, durationSeconds } = await recorderRef.current.stop();
        audioFloat32Ref.current = audioFloat32;
        setRecordedWavBlob(wavBlob);

        // If live speech yielded no text (e.g. Brave shields blocked Google speech API, or network blocked),
        // automatically run Whisper on the recorded audio so the user's speech is immediately transcribed!
        if (!transcriptText.trim() && audioFloat32 && audioFloat32.length > 0 && durationSeconds > 0) {
          await runWhisperTranscription(audioFloat32);
        }
      } catch {
        // ignore
      }
      recorderRef.current = null;
    }
  };

  // --- OFFLINE WHISPER HANDLERS ---
  const handleStartOffline = async () => {
    setErrorMessage(null);
    setIsNetworkError(false);
    setDetectedCommand(null);
    setRecordedWavBlob(null);

    try {
      recorderRef.current = new AudioRecorder((state) => {
        setRecorderState(state);
      });
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

  const handleStopAndTranscribeOffline = async () => {
    if (!recorderRef.current) return;
    try {
      const { audioFloat32, wavBlob, durationSeconds } = await recorderRef.current.stop();
      audioFloat32Ref.current = audioFloat32;
      setRecordedWavBlob(wavBlob);
      setIsListening(false);
      setIsPaused(false);

      if (durationSeconds === 0 || audioFloat32.length === 0) {
        setErrorMessage(t.noAudioRecorded);
        return;
      }

      await runWhisperTranscription(audioFloat32);
    } catch (err: any) {
      setErrorMessage(err.message || 'فشل تسجيل الصوت');
    }
  };

  // Re-transcribe current recorded buffer with Whisper
  const runWhisperTranscription = async (float32Data: Float32Array) => {
    try {
      setIsTranscribing(true);
      setTranscriptionProgress('جارٍ تهيئة نموذج Whisper...');

      const langCode = speechLanguage.startsWith('ar') ? 'ar' : 'en';
      const result = await transcribeAudio(
        float32Data,
        langCode,
        whisperModel,
        (p: WhisperProgress) => {
          setTranscriptionProgress(p.status);
        }
      );

      setTranscriptText((prev) => (prev ? `${prev.trim()}\n${result.text}` : result.text));

      if (isCommandMode) {
        const match = parseVoiceCommand(result.text);
        if (match) setDetectedCommand(match);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'فشل تحويل الصوت عبر Whisper');
    } finally {
      setIsTranscribing(false);
      setTranscriptionProgress('');
    }
  };

  // Upload an audio file directly
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setIsTranscribing(true);
    setTranscriptionProgress('جارٍ قراءة الملف الصوتي وتحويله...');

    try {
      const { audioFloat32 } = await decodeAudioFileTo16k(file);
      audioFloat32Ref.current = audioFloat32;
      setRecordedWavBlob(file);
      await runWhisperTranscription(audioFloat32);
    } catch (err: any) {
      setErrorMessage(`تعذر قراءة الملف الصوتي: ${err.message || err}`);
      setIsTranscribing(false);
      setTranscriptionProgress('');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Actions
  const handleApplyAppend = () => {
    const textToApply = interimText
      ? `${transcriptText} ${interimText}`.trim()
      : transcriptText.trim();

    if (textToApply) {
      onAppendText(textToApply);
      onClose();
    }
  };

  const handleApplyReplace = () => {
    const textToApply = interimText
      ? `${transcriptText} ${interimText}`.trim()
      : transcriptText.trim();

    if (textToApply) {
      onReplaceText(textToApply);
      onClose();
    }
  };

  const handleClearTranscript = () => {
    setTranscriptText('');
    setInterimText('');
  };

  const handleExecuteDetectedCommand = () => {
    if (detectedCommand && onExecuteCommand) {
      onExecuteCommand(detectedCommand);
      onClose();
    }
  };

  const handleExportTxt = () => {
    exportTextToTxt(transcriptText, 'transcript.txt');
  };

  const handleExportDocx = async () => {
    const blob = await generateDocxBlob({
      title: 'Speech Transcript',
      content: transcriptText,
    });
    downloadBlob(blob, 'transcript.docx');
  };

  const handleDownloadWav = () => {
    if (recordedWavBlob) {
      downloadBlob(recordedWavBlob, 'recorded_audio.wav');
    }
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Equalizer visual bars
  const volumeBarsCount = 12;
  const activeBars = Math.round(recorderState.volumeLevel * volumeBarsCount);

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
                  <FileDown size={14} />
                  <span>TXT</span>
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleExportDocx}>
                  <FileDown size={14} />
                  <span>Word</span>
                </button>
              </>
            )}
            {recordedWavBlob && (
              <button className="btn btn-secondary btn-sm" onClick={handleDownloadWav} title="حفظ التسجيل الصوتي كملف WAV">
                <FileDown size={14} />
                <span>تحميل الصوت (WAV)</span>
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-secondary" onClick={onClose}>
              {t.cancel}
            </button>
            {transcriptText && (
              <>
                <button className="btn btn-secondary" onClick={handleApplyReplace}>
                  {t.replaceEditor}
                </button>
                <button className="btn btn-primary" onClick={handleApplyAppend}>
                  {t.appendToEditor}
                </button>
              </>
            )}
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Engine Mode Selection */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
          <div
            onClick={() => {
              handleStopAll();
              setEngineMode('live');
            }}
            style={{
              padding: '0.75rem 1rem',
              border: `2px solid ${engineMode === 'live' ? 'var(--primary)' : 'var(--border-light)'}`,
              borderRadius: 'var(--radius-md)',
              backgroundColor: engineMode === 'live' ? 'var(--primary-light)' : 'var(--bg-card)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
            }}
          >
            <Radio size={22} style={{ color: engineMode === 'live' ? 'var(--primary)' : 'var(--text-muted)' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: engineMode === 'live' ? 'var(--primary)' : 'inherit' }}>
                الإملاء المباشر الفوري (Live Streaming)
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                يكتب أمامك كلمة بكلمة، دقة استثنائية في اللهجة المصرية والعربية، مع إمكانية الإيقاف والتعديل
              </div>
            </div>
          </div>

          <div
            onClick={() => {
              handleStopAll();
              setEngineMode('offline');
            }}
            style={{
              padding: '0.75rem 1rem',
              border: `2px solid ${engineMode === 'offline' ? 'var(--primary)' : 'var(--border-light)'}`,
              borderRadius: 'var(--radius-md)',
              backgroundColor: engineMode === 'offline' ? 'var(--primary-light)' : 'var(--bg-card)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
            }}
          >
            <Cpu size={22} style={{ color: engineMode === 'offline' ? 'var(--primary)' : 'var(--text-muted)' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: engineMode === 'offline' ? 'var(--primary)' : 'inherit' }}>
                الذكاء الاصطناعي المحلي (Whisper AI)
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                يعمل محلياً بالكامل دون إنترنت، ويدعم رفع ملفات صوتية من الهاتف
              </div>
            </div>
          </div>
        </div>

        {/* Brave Browser Notice */}
        {isBraveBrowser && (
          <div style={{ padding: '0.65rem 0.85rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 'var(--radius-sm)', fontSize: '0.84rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🦁</span>
            <div>
              <strong>ملاحظة لمتصفح Brave:</strong> يقوم متصفح Brave بحظر خدمات التعرف الصوتي السحابية لجوجل لحماية الخصوصية. لذلك يعمل وضع <strong>"الذكاء الاصطناعي المحلي (Whisper AI)"</strong> مباشرة بدون أي حجب، وسيتم تفريغ أي تسجيل تقوم به تلقائياً.
            </div>
          </div>
        )}

        {/* Options Row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>اللغة / اللهجة:</label>
            <select
              className="search-input"
              style={{ width: 'auto', padding: '0.35rem 0.75rem', fontWeight: 600 }}
              value={speechLanguage}
              onChange={(e) => {
                setSpeechLanguage(e.target.value);
                if (isListening && engineMode === 'live') {
                  handleStopLive();
                }
              }}
            >
              <option value="ar-EG">العربية - مصر (اللهجة المصرية والفصحى)</option>
              <option value="ar-SA">العربية - السعودية والخليج</option>
              <option value="ar">العربية - فصحى عامة</option>
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
            </select>

            {engineMode === 'offline' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>النموذج:</label>
                <select
                  className="search-input"
                  style={{ width: 'auto', padding: '0.35rem 0.75rem', fontWeight: 600 }}
                  value={whisperModel}
                  onChange={(e) => setWhisperModel(e.target.value)}
                >
                  <option value="onnx-community/whisper-base">Whisper Base (دقة عالية جداً للعربية ~74MB)</option>
                  <option value="onnx-community/whisper-tiny">Whisper Tiny (سريع وخفيف ~39MB)</option>
                </select>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem' }}>
              <input
                type="checkbox"
                checked={isCommandMode}
                onChange={(e) => setIsCommandMode(e.target.checked)}
              />
              <Command size={15} style={{ color: isCommandMode ? 'var(--primary)' : 'inherit' }} />
              <span>{t.voiceCommandMode}</span>
            </label>

            {/* Audio File Upload trigger */}
            <input
              type="file"
              ref={fileInputRef}
              accept="audio/*"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => fileInputRef.current?.click()}
              title="رفع ملف صوتي مسجل من هاتفك أو حاسوبك لتفريغه"
              disabled={isListening || isTranscribing}
            >
              <Upload size={14} />
              <span>رفع ملف صوتي</span>
            </button>
          </div>
        </div>

        {isCommandMode && (
          <div style={{ padding: '0.65rem 0.85rem', backgroundColor: 'var(--primary-light)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--primary)' }}>
            {t.voiceCommandHint}
          </div>
        )}

        {/* Central Recording & Soundwave Monitor Box */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            padding: '1.25rem',
            backgroundColor: isListening ? 'rgba(79, 70, 229, 0.04)' : 'var(--bg-muted)',
            borderRadius: 'var(--radius-lg)',
            border: `2px solid ${isListening ? 'var(--primary)' : 'var(--border-light)'}`,
            transition: 'all 0.2s ease',
          }}
        >
          {/* Status Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.95rem', fontWeight: 700 }}>
            {isListening ? (
              <>
                <span
                  style={{
                    display: 'inline-block',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--danger)',
                    boxShadow: '0 0 10px var(--danger)',
                    animation: 'pulse 1.2s infinite',
                  }}
                />
                <span style={{ color: 'var(--danger)' }}>
                  {engineMode === 'live' ? 'الميكروفون يستمع ويكتب أمامك مباشرة...' : 'جارٍ التسجيل الصوتي...'}
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: '1.1rem', color: 'var(--text-main)', marginRight: '0.5rem' }}>
                  ({formatSeconds(recorderState.durationSeconds)})
                </span>
              </>
            ) : isPaused ? (
              <span style={{ color: 'var(--warning)', fontWeight: 700 }}>
                ⏸️ متوقف مؤقتاً للتعديل — يمكنك تعديل الكلمات بالأسفل ثم النقر على "استئناف"
              </span>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>
                {engineMode === 'live'
                  ? 'اضغط على "بدء الإملاء المباشر" وتحدث بحرية أمام الميكروفون'
                  : 'اضغط على "بدء التسجيل المحلي" ثم تحدث واضغط "إنهاء وتحويل"'}
              </span>
            )}
          </div>

          {/* Interactive Equalizer Sound Waves (active in both modes whenever mic is active) */}
          {isListening && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', width: '100%', maxWidth: '360px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  gap: '4px',
                  height: '36px',
                  width: '100%',
                  padding: '4px 0',
                }}
              >
                {Array.from({ length: volumeBarsCount }).map((_, idx) => {
                  const isActive = idx < activeBars;
                  const barHeight = isActive
                    ? Math.max(12, Math.min(32, Math.round(recorderState.volumeLevel * 36 * (1 + (idx % 3) * 0.2))))
                    : 6;
                  return (
                    <div
                      key={idx}
                      style={{
                        width: '8px',
                        height: `${barHeight}px`,
                        backgroundColor: isActive
                          ? idx > 8
                            ? 'var(--danger)'
                            : idx > 5
                            ? 'var(--warning)'
                            : 'var(--success)'
                          : 'rgba(150, 150, 150, 0.3)',
                        borderRadius: '4px',
                        transition: 'height 0.08s ease, background-color 0.08s ease',
                      }}
                    />
                  );
                })}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <Volume2 size={13} style={{ color: recorderState.volumeLevel > 0.05 ? 'var(--success)' : 'inherit' }} />
                <span>
                  مستوى التقاط الصوت: {Math.round(recorderState.volumeLevel * 100)}%
                  {recorderState.volumeLevel < 0.02 && recorderState.durationSeconds > 2 && (
                    <strong style={{ color: 'var(--danger)', marginRight: '6px' }}>
                      (صامت - تأكد من عدم كتم الميكروفون والتحدث بوضوح)
                    </strong>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Audio Player if recorded */}
          {recordedAudioUrl && !isListening && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', width: '100%', maxWidth: '400px', marginTop: '0.25rem' }}>
              <audio controls src={recordedAudioUrl} style={{ width: '100%', height: '36px' }} />
              {audioFloat32Ref.current && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => runWhisperTranscription(audioFloat32Ref.current!)}
                  disabled={isTranscribing}
                  style={{ width: '100%', padding: '0.55rem', fontWeight: 700 }}
                >
                  <Sparkles size={15} />
                  <span>⚡ تفريغ هذا التسجيل الصوتي الآن إلى نص عبر الذكاء الاصطناعي</span>
                </button>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            {engineMode === 'live' ? (
              !isListening ? (
                isPaused ? (
                  <>
                    <button
                      className="btn btn-primary"
                      onClick={handleResumeLive}
                      style={{ padding: '0.75rem 1.75rem', fontSize: '1rem' }}
                    >
                      <Play size={18} />
                      <span>استئناف الإملاء (Resume)</span>
                    </button>
                    <button className="btn btn-secondary" onClick={handleStopLive}>
                      <Square size={16} />
                      <span>إنهاء (Done)</span>
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={handleStartLive}
                    style={{ padding: '0.85rem 2rem', fontSize: '1.05rem', fontWeight: 700 }}
                  >
                    <Mic size={22} />
                    <span>بدء الإملاء المباشر (Start Live)</span>
                  </button>
                )
              ) : (
                <>
                  <button
                    className="btn btn-secondary"
                    onClick={handlePauseLive}
                    style={{ padding: '0.75rem 1.5rem', fontWeight: 700 }}
                  >
                    <Pause size={18} style={{ color: 'var(--warning)' }} />
                    <span>إيقاف مؤقت للتعديل (Pause & Edit)</span>
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={handleStopLive}
                    style={{ padding: '0.75rem 1.75rem' }}
                  >
                    <Square size={18} />
                    <span>إنهاء الإملاء (Done)</span>
                  </button>
                </>
              )
            ) : (
              // Offline mode controls
              !recorderState.isRecording ? (
                <button
                  className="btn btn-primary"
                  onClick={handleStartOffline}
                  disabled={isTranscribing}
                  style={{ padding: '0.85rem 2rem', fontSize: '1.05rem', fontWeight: 700 }}
                >
                  <Mic size={22} />
                  <span>بدء التسجيل الصوتي</span>
                </button>
              ) : (
                <>
                  {recorderState.isPaused ? (
                    <button className="btn btn-secondary" onClick={handleResumeOffline}>
                      <Play size={18} />
                      <span>استئناف التسجيل</span>
                    </button>
                  ) : (
                    <button className="btn btn-secondary" onClick={handlePauseOffline}>
                      <Pause size={18} />
                      <span>إيقاف مؤقت</span>
                    </button>
                  )}

                  <button
                    className="btn btn-danger"
                    onClick={handleStopAndTranscribeOffline}
                    style={{ padding: '0.75rem 1.75rem' }}
                  >
                    <Square size={18} />
                    <span>إنهاء وتحويل للنص</span>
                  </button>
                </>
              )
            )}
          </div>

          {/* Progress feedback for offline / file transcription */}
          {isTranscribing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--primary)', fontSize: '0.92rem', fontWeight: 600 }}>
              <Sparkles size={18} className="spinner" />
              <span>{transcriptionProgress || t.transcribing}</span>
            </div>
          )}

          {/* Error Message with Smart 1-Click Fallback */}
          {errorMessage && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                padding: '0.85rem 1rem',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--danger)',
                fontSize: '0.88rem',
                width: '100%',
                maxWidth: '560px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>

              {/* If network error or if audio was recorded, offer 1-click local Whisper fallback */}
              {(isNetworkError || (audioFloat32Ref.current && audioFloat32Ref.current.length > 0)) && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setEngineMode('offline');
                      if (audioFloat32Ref.current) {
                        runWhisperTranscription(audioFloat32Ref.current);
                      }
                    }}
                  >
                    <Cpu size={14} />
                    <span>⚡ تفريغ التسجيل بالذكاء الاصطناعي المحلي (بدون إنترنت مجاناً)</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Detected Voice Command Banner */}
        {detectedCommand && (
          <div
            style={{
              padding: '1rem',
              backgroundColor: isDestructiveCommand(detectedCommand.command) ? 'var(--danger-light)' : 'var(--success-light)',
              border: `1px solid ${isDestructiveCommand(detectedCommand.command) ? 'var(--danger-border)' : 'var(--success-border)'}`,
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                {t.commandDetected} <strong>"{detectedCommand.phrase}"</strong>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {isDestructiveCommand(detectedCommand.command)
                  ? 'أمر حساس يتطلب تأكيدك لتفادي فقدان البيانات.'
                  : 'يمكنك تأكيد تنفيذ الأمر الآن.'}
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

        {/* Live Interim Streaming Words Banner (Visibly displays what the mic is hearing in real-time) */}
        {isListening && (
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: interimText ? 'rgba(79, 70, 229, 0.08)' : 'var(--bg-muted)',
              border: `1px dashed ${interimText ? 'var(--primary)' : 'var(--border-light)'}`,
              borderRadius: 'var(--radius-md)',
              fontSize: '1.05rem',
              color: interimText ? 'var(--primary)' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              minHeight: '44px',
            }}
          >
            <Sparkles size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <span>
              {interimText ? (
                <strong>{interimText}</strong>
              ) : (
                'تحدث الآن في الميكروفون... الكلمات ستظهر هنا فورياً ومباشرة أمامك كلمة بكلمة'
              )}
            </span>
          </div>
        )}

        {/* In-place Editable Text Box */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '0.92rem', fontWeight: 700 }}>
              {t.transcriptionResult} (قابل للتعديل والكتابة المباشرة):
            </label>
            {transcriptText && (
              <button
                className="btn btn-secondary btn-icon"
                onClick={handleClearTranscript}
                title="مسح النص"
                style={{ padding: '2px 8px', fontSize: '0.75rem', color: 'var(--danger)' }}
              >
                <Trash2 size={13} />
                <span>مسح النص</span>
              </button>
            )}
          </div>

          <textarea
            className="editor-textarea"
            style={{
              minHeight: '180px',
              border: isPaused ? '2px solid var(--warning)' : '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
              fontSize: '1.05rem',
              lineHeight: 1.8,
            }}
            value={transcriptText}
            onChange={(e) => setTranscriptText(e.target.value)}
            placeholder="تحدث وسيتم تفريغ كلامك هنا مباشرة... يمكنك التعديل والإضافة يدوياً في أي لحظة."
          />
        </div>
      </div>
    </Modal>
  );
};
