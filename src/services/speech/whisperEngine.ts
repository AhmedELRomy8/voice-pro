import type { SpeechResult } from '../../types';

export interface WhisperProgress {
  status: string;
  progress?: number;
}

export type WhisperProgressCallback = (p: WhisperProgress) => void;

let transcriberPromise: Promise<any> | null = null;
let currentModelName = 'Xenova/whisper-tiny';

export async function getWhisperTranscriber(
  modelName = 'Xenova/whisper-tiny',
  onProgress?: WhisperProgressCallback
): Promise<any> {
  if (transcriberPromise && currentModelName === modelName) {
    return transcriberPromise;
  }

  currentModelName = modelName;

  transcriberPromise = (async () => {
    // Dynamically import @xenova/transformers so it loads only when speech is used
    const { pipeline, env } = await import('@xenova/transformers');

    // Configure local browser caching
    env.allowLocalModels = false;
    env.useBrowserCache = true;

    if (onProgress) {
      onProgress({ status: 'جارٍ تهيئة نموذج Whisper المحلي... / Initializing local Whisper model...' });
    }

    try {
      const transcriber = await pipeline('automatic-speech-recognition', modelName, {
        quantized: true,
        progress_callback: (item: any) => {
          if (onProgress) {
            let statusText = 'جارٍ تحميل النموذج محلياً... / Downloading model...';
            if (item.status === 'progress' && item.file) {
              statusText = `تنزيل ${item.file} (${Math.round(item.progress || 0)}%)`;
            } else if (item.status === 'ready') {
              statusText = 'النموذج جاهز في ذاكرة المتصفح / Model ready';
            }
            onProgress({
              status: statusText,
              progress: item.progress ? item.progress / 100 : undefined,
            });
          }
        },
      });

      return transcriber;
    } catch (err: any) {
      transcriberPromise = null;
      throw new Error(
        `تعذر تحميل نموذج Whisper محلياً: ${err.message || err}. يرجى التحقق من توفر ذاكرة كافية في المتصفح.`
      );
    }
  })();

  return transcriberPromise;
}

export async function transcribeAudio(
  audioFloat32: Float32Array,
  language: 'ar' | 'en' | 'auto' = 'ar',
  modelName = 'Xenova/whisper-tiny',
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

export async function isWhisperModelCached(modelName = 'Xenova/whisper-tiny'): Promise<boolean> {
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
