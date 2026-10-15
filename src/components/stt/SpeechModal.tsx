import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Square,
  Pause,
  Play,
  FileDown,
  Volume2,
  AlertCircle,
  Sparkles,
  Command
} from 'lucide-react';
import { Modal } from '../layout/Modal';
import { useTranslation } from '../../i18n/useTranslation';
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
  const { t, lang } = useTranslation();

  const [recorderState, setRecorderState] = useState<RecorderState>({
    isRecording: false,
    isPaused: false,
    durationSeconds: 0,
    volumeLevel: 0,
  });

  const [speechLanguage, setSpeechLanguage] = useState<'ar' | 'en' | 'auto'>('ar');
  const [isCommandMode, setIsCommandMode] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState<string>('');
  const [transcriptText, setTranscriptText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detectedCommand, setDetectedCommand] = useState<VoiceCommandMatch | null>(null);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const audioFloat32Ref = useRef<Float32Array | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (recorderRef.current) {
        recorderRef.current.cancel();
      }
      setRecorderState({
        isRecording: false,
        isPaused: false,
        durationSeconds: 0,
        volumeLevel: 0,
      });
      setErrorMessage(null);
      setDetectedCommand(null);
    }
  }, [isOpen]);

  const handleStart = async () => {
    setErrorMessage(null);
    setDetectedCommand(null);
    try {
      recorderRef.current = new AudioRecorder((state) => {
        setRecorderState(state);
      });
      await recorderRef.current.start();
    } catch (err: any) {
      setErrorMessage(err.message || t.micPermissionError);
    }
  };

  const handlePause = () => {
    if (recorderRef.current) {
      recorderRef.current.pause();
    }
  };

  const handleResume = () => {
    if (recorderRef.current) {
      recorderRef.current.resume();
    }
  };

  const handleStopAndTranscribe = async () => {
    if (!recorderRef.current) return;
    try {
      const { audioFloat32, durationSeconds } = await recorderRef.current.stop();
      audioFloat32Ref.current = audioFloat32;

      if (durationSeconds === 0 || audioFloat32.length === 0) {
        setErrorMessage(t.noAudioRecorded);
        return;
      }

      setIsTranscribing(true);
      setTranscriptionProgress(t.transcribing);

      const result = await transcribeAudio(
        audioFloat32,
        speechLanguage,
        'Xenova/whisper-tiny',
        (p: WhisperProgress) => {
          setTranscriptionProgress(p.status);
        }
      );

      setTranscriptText(result.text);

      // If in command mode, check for deterministic voice command
      if (isCommandMode) {
        const cmdMatch = parseVoiceCommand(result.text);
        if (cmdMatch) {
          setDetectedCommand(cmdMatch);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'فشل تحويل الصوت / Transcription failed');
    } finally {
      setIsTranscribing(false);
      setTranscriptionProgress('');
    }
  };

  const handleApplyAppend = () => {
    if (transcriptText) {
      onAppendText(transcriptText);
      onClose();
    }
  };

  const handleApplyReplace = () => {
    if (transcriptText) {
      onReplaceText(transcriptText);
      onClose();
    }
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
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
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
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {t.speechInstruction}
        </p>

        {/* Language & Command Mode Bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t.documentLanguage}:</label>
            <select
              className="search-input"
              style={{ width: 'auto', padding: '0.35rem 0.75rem' }}
              value={speechLanguage}
              onChange={(e) => setSpeechLanguage(e.target.value as any)}
            >
              <option value="ar">{t.arabic}</option>
              <option value="en">{t.english}</option>
              <option value="auto">Auto / تلقائي</option>
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

        {/* Recording Controls & Timer */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1.5rem', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'monospace' }}>
            {formatSeconds(recorderState.durationSeconds)}
          </div>

          {/* Audio volume visualizer */}
          <div className="audio-meter" style={{ maxWidth: '300px' }}>
            <div
              className="audio-meter-fill"
              style={{
                width: `${Math.round(recorderState.volumeLevel * 100)}%`,
                backgroundColor: recorderState.isPaused ? 'var(--warning)' : 'var(--success)',
              }}
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {!recorderState.isRecording ? (
              <button
                className="btn btn-primary"
                onClick={handleStart}
                disabled={isTranscribing}
                style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}
              >
                <Mic size={20} />
                <span>{t.startRecording}</span>
              </button>
            ) : (
              <>
                {recorderState.isPaused ? (
                  <button className="btn btn-secondary" onClick={handleResume}>
                    <Play size={18} />
                    <span>{t.resumeRecording}</span>
                  </button>
                ) : (
                  <button className="btn btn-secondary" onClick={handlePause}>
                    <Pause size={18} />
                    <span>{t.pauseRecording}</span>
                  </button>
                )}

                <button
                  className="btn btn-danger"
                  onClick={handleStopAndTranscribe}
                  style={{ padding: '0.75rem 1.5rem' }}
                >
                  <Square size={18} />
                  <span>{t.stopRecording} & {t.transcribe}</span>
                </button>
              </>
            )}
          </div>

          {/* Progress / Status feedback */}
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

        {/* Editable Transcript Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>{t.transcriptionResult}:</label>
          <textarea
            className="editor-textarea"
            style={{ minHeight: '140px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}
            value={transcriptText}
            onChange={(e) => setTranscriptText(e.target.value)}
            placeholder="سيظهر النص المحول هنا ويمكنك تعديله بحرية قبل الإضافة..."
          />
        </div>
      </div>
    </Modal>
  );
};
