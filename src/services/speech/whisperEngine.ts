import type { SpeechResult } from '../../types';

export interface WhisperProgress {
  status: string;
  progress?: number;
}

export type WhisperProgressCallback = (p: WhisperProgress) => void;

let transcriberPromise: Promise<any> | null = null;
let currentModelName = 'onnx-community/whisper-tiny';

export async function getWhisperTranscriber(
  modelName = 'onnx-community/whisper-tiny',
  onProgress?: WhisperProgressCallback
): Promise<any> {
  if (transcriberPromise && currentModelName === modelName) {
    return transcriberPromise;
  }

  currentModelName = modelName;

  transcriberPromise = (async () => {
    if (onProgress) {
      onProgress({ status: 'جارٍ تهيئة محرك Whisper المحلي... / Initializing Whisper engine...' });
    }

    try {
      // Dynamically import @huggingface/transformers for browser WebAssembly inference
      const { pipeline, env } = await import('@huggingface/transformers');

      // Configure local caching in browser Cache API / IndexedDB
      env.allowLocalModels = false;
      env.useBrowserCache = true;

      const transcriber = await pipeline('automatic-speech-recognition', modelName, {
        dtype: 'q8', // Quantized 8-bit for fast local execution and low memory footprint (~39MB)
        device: 'wasm',
        progress_callback: (item: any) => {
          if (onProgress) {
            let statusText = 'جارٍ تحميل النموذج محلياً... / Downloading model...';
            if (item.status === 'progress' && item.file) {
              const pct = Math.round((item.loaded / (item.total || 1)) * 100);
              statusText = `تنزيل ${item.file} (${pct}%)`;
            } else if (item.status === 'ready' || item.status === 'done') {
              statusText = 'النموذج جاهز في ذاكرة المتصفح / Model ready';
            }
            onProgress({
              status: statusText,
              progress: item.total ? item.loaded / item.total : undefined,
            });
          }
        },
      });

      return transcriber;
    } catch (err: any) {
      transcriberPromise = null;
      console.error('Whisper local load error:', err);
      throw new Error(
        `تعذر تشغيل نموذج Whisper محلياً (${err.message || err}). يمكنك حفظ التسجيل كملف WAV وتشغيله عبر تطبيق الويندوز.`
      );
    }
  })();

  return transcriberPromise;
}

export async function transcribeAudio(
  audioFloat32: Float32Array,
  language: 'ar' | 'en' | 'auto' = 'ar',
  modelName = 'onnx-community/whisper-tiny',
  onProgress?: WhisperProgressCallback
): Promise<SpeechResult> {
  if (audioFloat32.length === 0) {
    throw new Error('الملف الصوتي فارغ / Audio data is empty');
  }

  const startTime = Date.now();
  const transcriber = await getWhisperTranscriber(modelName, onProgress);

  if (onProgress) {
    onProgress({ status: 'جارٍ تحليل الصوت وتحويله إلى نص... / Transcribing audio locally...' });
  }

  // Whisper language mapping
  const langParam = language === 'ar' ? 'arabic' : language === 'en' ? 'english' : null;

  const options: Record<string, any> = {
    task: 'transcribe',
    return_timestamps: false,
    chunk_length_s: 30,
    stride_length_s: 5,
  };

  if (langParam) {
    options.language = langParam;
  }

  const output = await transcriber(audioFloat32, options);

  const durationSeconds = Math.round((Date.now() - startTime) / 1000);
  const text = (typeof output === 'string' ? output : output.text || '').trim();

  return {
    text,
    language: language === 'auto' ? 'detected' : language,
    durationSeconds,
  };
}

export async function isWhisperModelCached(modelName = 'onnx-community/whisper-tiny'): Promise<boolean> {
  if ('caches' in window) {
    try {
      const keys = await window.caches.keys();
      for (const key of keys) {
        if (key.includes('transformers') || key.includes('onnx')) {
          const cache = await window.caches.open(key);
          const requests = await cache.keys();
          if (requests.some((r) => r.url.includes(modelName.split('/')[1] || 'whisper'))) {
            return true;
          }
        }
      }
    } catch (e) {
      console.warn('Cache check note:', e);
    }
  }
  return false;
}

// Decode audio file (WAV, MP3, M4A, OGG) to 16kHz mono Float32Array for local transcription
export async function decodeAudioFileTo16k(audioBlob: Blob): Promise<{ audioFloat32: Float32Array; durationSeconds: number }> {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContextClass();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const durationSeconds = Math.round(audioBuffer.duration);
  audioCtx.close();

  const { resampleTo16k } = await import('./audioRecorder');
  const final16k = resampleTo16k(channelData, sampleRate);

  return {
    audioFloat32: final16k,
    durationSeconds,
  };
}

