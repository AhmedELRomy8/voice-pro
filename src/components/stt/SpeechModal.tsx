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
  Trash2
} from 'lucide-react';
import { Modal } from '../layout/Modal';
import { useTranslation } from '../../i18n/useTranslation';
import { LiveSpeechRecognizer } from '../../services/speech/liveSpeechRecognition';
import { AudioRecorder, type RecorderState } from '../../services/speech/audioRecorder';
import { transcribeAudio, type WhisperProgress } from '../../services/speech/whisperEngine';
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

  // Engine mode: 'live' (Streaming Web Speech with live typing) or 'offline' (Whisper WASM)
  const isLiveSupported = LiveSpeechRecognizer.isSupported();
  const [engineMode, setEngineMode] = useState<'live' | 'offline'>(
    isLiveSupported ? 'live' : 'offline'
  );

  const [speechLanguage, setSpeechLanguage] = useState<string>('ar-EG');
  const [isCommandMode, setIsCommandMode] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [transcriptText, setTranscriptText] = useState<string>('');
  const [interimText, setInterimText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detectedCommand, setDetectedCommand] = useState<VoiceCommandMatch | null>(null);

  // Offline mode state
  const [recorderState, setRecorderState] = useState<RecorderState>({
    isRecording: false,
    isPaused: false,
    durationSeconds: 0,
    volumeLevel: 0,
  });
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState<string>('');
  const [recordedWavBlob, setRecordedWavBlob] = useState<Blob | null>(null);

  const liveRecognizerRef = useRef<LiveSpeechRecognizer | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const audioFloat32Ref = useRef<Float32Array | null>(null);

  useEffect(() => {
    if (!isOpen) {
      handleStopAll();
      setErrorMessage(null);
      setDetectedCommand(null);
      setInterimText('');
    }
  }, [isOpen]);

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
          if (isCommandMode) {
            const match = parseVoiceCommand(text);
            if (match) setDetectedCommand(match);
          }
          return updated;
        });
        setInterimText('');
      },
      onError: (err) => {
        setErrorMessage(err);
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
    // Finalize any interim text into the main box so the user can edit it
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

  const handleStopLive = () => {
    handlePauseLive();
    setIsPaused(false);
  };

  // --- OFFLINE WHISPER HANDLERS ---
  const handleStartOffline = async () => {
    setErrorMessage(null);
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

      setIsTranscribing(true);
      setTranscriptionProgress(t.transcribing);

      const langCode = speechLanguage.startsWith('ar') ? 'ar' : 'en';
      const result = await transcribeAudio(
        audioFloat32,
        langCode,
        'onnx-community/whisper-tiny',
        (p: WhisperProgress) => {
          setTranscriptionProgress(p.status);
        }
      );

      setTranscriptText((prev) => (prev ? `${prev}\n${result.text}` : result.text));

      if (isCommandMode) {
        const match = parseVoiceCommand(result.text);
        if (match) setDetectedCommand(match);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'فشل تحويل الصوت');
    } finally {
      setIsTranscribing(false);
      setTranscriptionProgress('');
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
              <button className="btn btn-secondary btn-sm" onClick={handleDownloadWav} title="حفظ التسجيل كملف WAV">
                <FileDown size={14} />
                <span>حفظ WAV</span>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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
            <Radio size={20} style={{ color: engineMode === 'live' ? 'var(--primary)' : 'var(--text-muted)' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: engineMode === 'live' ? 'var(--primary)' : 'inherit' }}>
                إملاء مباشر فوري (Live Streaming)
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                يكتب أمامك كلمة بكلمة، دقة عالية جداً في فهم العربية، مع إمكانية الإيقاف المؤقت والتعديل
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
            <Cpu size={20} style={{ color: engineMode === 'offline' ? 'var(--primary)' : 'var(--text-muted)' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: engineMode === 'offline' ? 'var(--primary)' : 'inherit' }}>
                النموذج المحلي غير المتصل (Whisper WASM)
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                يعمل محلياً بالكامل في ذاكرة المتصفح للعمل دون أي إنترنت
              </div>
            </div>
          </div>
        </div>

        {/* Options & Dialect Selection */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>اللهجة / اللغة:</label>
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
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem' }}>
            <input
              type="checkbox"
              checked={isCommandMode}
              onChange={(e) => setIsCommandMode(e.target.checked)}
            />
            <Command size={15} style={{ color: isCommandMode ? 'var(--primary)' : 'inherit' }} />
            <span>{t.voiceCommandMode}</span>
          </label>
        </div>

        {isCommandMode && (
          <div style={{ padding: '0.65rem 0.85rem', backgroundColor: 'var(--primary-light)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--primary)' }}>
            {t.voiceCommandHint}
          </div>
        )}

        {/* Recording / Listening Box */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            padding: '1.25rem',
            backgroundColor: isListening ? 'var(--primary-light)' : 'var(--bg-muted)',
            borderRadius: 'var(--radius-lg)',
            border: `1px solid ${isListening ? 'var(--primary-border)' : 'var(--border-light)'}`,
            transition: 'all 0.2s ease',
          }}
        >
          {/* Live Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 700 }}>
            {isListening ? (
              <>
                <span
                  style={{
                    display: 'inline-block',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--danger)',
                    boxShadow: '0 0 8px var(--danger)',
                  }}
                />
                <span style={{ color: 'var(--danger)' }}>
                  {engineMode === 'live' ? 'الميكروفون يستمع ويكتب مباشرة...' : 'جارٍ التسجيل الصوتي...'}
                </span>
              </>
            ) : isPaused ? (
              <span style={{ color: 'var(--warning)' }}>
                متوقف مؤقتاً للتعديل — يمكنك تعديل الكلمات بالأسفل ثم الضغط على "استئناف"
              </span>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>
                {engineMode === 'live'
                  ? 'اضغط على زر "بدء الإملاء المباشر" وتحدث بحرية'
                  : 'اضغط على "بدء التسجيل" ثم "إنهاء وتحويل"'}
              </span>
            )}
          </div>

          {/* Volume meter for offline */}
          {engineMode === 'offline' && (
            <>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, fontFamily: 'monospace' }}>
                {formatSeconds(recorderState.durationSeconds)}
              </div>
              <div className="audio-meter" style={{ maxWidth: '300px' }}>
                <div
                  className="audio-meter-fill"
                  style={{
                    width: `${Math.round(recorderState.volumeLevel * 100)}%`,
                    backgroundColor: recorderState.isPaused ? 'var(--warning)' : 'var(--success)',
                  }}
                />
              </div>
            </>
          )}

          {/* Action buttons */}
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
                      <span>استئناف التحدث (Resume)</span>
                    </button>
                    <button className="btn btn-secondary" onClick={handleStopLive}>
                      <Square size={16} />
                      <span>إنهاء (Finish)</span>
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={handleStartLive}
                    style={{ padding: '0.75rem 1.75rem', fontSize: '1rem' }}
                  >
                    <Mic size={20} />
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
                    <span>إيقاف مؤقت لتعديل الكلمات (Pause & Edit)</span>
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={handleStopLive}
                    style={{ padding: '0.75rem 1.5rem' }}
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
                  style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}
                >
                  <Mic size={20} />
                  <span>بدء التسجيل المحلي</span>
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
                    style={{ padding: '0.75rem 1.5rem' }}
                  >
                    <Square size={18} />
                    <span>إنهاء وتحويل للنص</span>
                  </button>
                </>
              )
            )}
          </div>

          {/* Progress feedback for offline */}
          {isTranscribing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontSize: '0.9rem' }}>
              <Sparkles size={16} />
              <span>{transcriptionProgress || t.transcribing}</span>
            </div>
          )}

          {errorMessage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)', fontSize: '0.85rem' }}>
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
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

        {/* Live Interim Streaming Badge */}
        {interimText && (
          <div
            style={{
              padding: '0.65rem 1rem',
              backgroundColor: 'var(--primary-light)',
              border: '1px dashed var(--primary)',
              borderRadius: 'var(--radius-md)',
              fontSize: '1rem',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Sparkles size={18} />
            <span>{interimText}...</span>
          </div>
        )}

        {/* In-place Editable Text Box */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 700 }}>
              {t.transcriptionResult} (قابل للتعديل والكتابة المباشرة في أي لحظة):
            </label>
            {transcriptText && (
              <button
                className="btn btn-secondary btn-icon"
                onClick={handleClearTranscript}
                title="مسح النص"
                style={{ padding: '2px 6px', fontSize: '0.75rem', color: 'var(--danger)' }}
              >
                <Trash2 size={13} />
                <span>مسح</span>
              </button>
            )}
          </div>

          <textarea
            className="editor-textarea"
            style={{
              minHeight: '170px',
              border: isPaused ? '2px solid var(--warning)' : '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
              fontSize: '1.05rem',
              lineHeight: 1.8,
            }}
            value={transcriptText}
            onChange={(e) => setTranscriptText(e.target.value)}
            placeholder="تحدث وسيظهر الكلام هنا مباشرة وبدقة عالية أمامك كلمة بكلمة... يمكنك الضغط على 'إيقاف مؤقت' لتعديل أي كلمة ثم المتابعة."
          />
        </div>
      </div>
    </Modal>
  );
};
