// 16kHz Mono Audio Recorder for local speech recognition

export interface RecorderState {
  isRecording: boolean;
  isPaused: boolean;
  durationSeconds: number;
  volumeLevel: number; // 0 to 1
}

export type RecorderStateCallback = (state: RecorderState) => void;

export class AudioRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  
  private pcmChunks: Float32Array[] = [];
  private totalSamples = 0;
  
  private isRecording = false;
  private isPaused = false;
  private startTime = 0;
  private pausedDuration = 0;
  private pauseStartTime = 0;
  private timerInterval: any = null;
  private onStateChange: RecorderStateCallback | null = null;

  constructor(onStateChange?: RecorderStateCallback) {
    if (onStateChange) this.onStateChange = onStateChange;
  }

  public async start(): Promise<void> {
    this.pcmChunks = [];
    this.totalSamples = 0;
    this.pausedDuration = 0;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error('تم رفض الإذن للوصول إلى الميكروفون / Microphone permission denied');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        throw new Error('لم يتم العثور على جهاز ميكروفون متصل / No microphone found');
      } else {
        throw new Error(`خطأ في تشغيل الميكروفون: ${err.message || err.name}`);
      }
    }

    // Whisper requires 16000Hz mono audio
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    try {
      this.audioContext = new AudioContextClass({ sampleRate: 16000 });
    } catch {
      // Some browsers (e.g. Safari) don't support custom sampleRate in constructor
      this.audioContext = new AudioContextClass();
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 256;

    // Buffer size 4096, 1 input channel, 1 output channel
    this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processorNode.onaudioprocess = (e) => {
      if (!this.isRecording || this.isPaused) return;

      const inputData = e.inputBuffer.getChannelData(0);
      const copy = new Float32Array(inputData.length);
      copy.set(inputData);
      this.pcmChunks.push(copy);
      this.totalSamples += copy.length;
    };

    this.sourceNode.connect(this.analyserNode);
    this.analyserNode.connect(this.processorNode);
    this.processorNode.connect(this.audioContext.destination);

    this.isRecording = true;
    this.isPaused = false;
    this.startTime = Date.now();

    this.timerInterval = setInterval(() => {
      this.emitState();
    }, 100);

    this.emitState();
  }

  public pause(): void {
    if (this.isRecording && !this.isPaused) {
      this.isPaused = true;
      this.pauseStartTime = Date.now();
      this.emitState();
    }
  }

  public resume(): void {
    if (this.isRecording && this.isPaused) {
      this.isPaused = false;
      this.pausedDuration += Date.now() - this.pauseStartTime;
      this.emitState();
    }
  }

  public async stop(): Promise<{ audioFloat32: Float32Array; wavBlob: Blob; durationSeconds: number }> {
    if (!this.isRecording) {
      throw new Error('المسجل ليس في حالة تسجيل / Recorder is not active');
    }

    const durationSeconds = this.getDurationSeconds();
    const actualSampleRate = this.audioContext?.sampleRate || 16000;
    this.cleanup();

    // Flatten all Float32 chunks into one contiguous buffer
    const merged = new Float32Array(this.totalSamples);
    let offset = 0;
    for (const chunk of this.pcmChunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    // High quality resample to 16000 Hz if hardware recorded at 44.1k or 48k
    const final16kSamples = resampleTo16k(merged, actualSampleRate);

    // Convert to standard 16kHz 16-bit PCM WAV Blob
    const wavBlob = encodeWav(final16kSamples, 16000);

    return {
      audioFloat32: final16kSamples,
      wavBlob,
      durationSeconds,
    };
  }

  public cancel(): void {
    this.cleanup();
  }

  private cleanup(): void {
    this.isRecording = false;
    this.isPaused = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.emitState();
  }

  private getDurationSeconds(): number {
    if (!this.isRecording) return 0;
    const now = this.isPaused ? this.pauseStartTime : Date.now();
    return Math.max(0, Math.round((now - this.startTime - this.pausedDuration) / 1000));
  }

  private getVolumeLevel(): number {
    if (!this.analyserNode || !this.isRecording || this.isPaused) return 0;
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const avg = sum / dataArray.length;
    return Math.min(1, avg / 128);
  }

  private emitState(): void {
    if (this.onStateChange) {
      this.onStateChange({
        isRecording: this.isRecording,
        isPaused: this.isPaused,
        durationSeconds: this.getDurationSeconds(),
        volumeLevel: this.getVolumeLevel(),
      });
    }
  }
}

// Encode 16kHz mono Float32Array to valid WAV File
export function encodeWav(samples: Float32Array, sampleRate = 16000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* RIFF chunk length */
  view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw PCM) */
  view.setUint16(20, 1, true);
  /* channel count (1 = mono) */
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sampleRate * 1 * 2) */
  view.setUint32(28, sampleRate * 2, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);

  // Write PCM audio samples (Float32 to 16-bit signed PCM)
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// Resample audio Float32Array from any sample rate to 16,000 Hz using linear interpolation
export function resampleTo16k(audioData: Float32Array, origSampleRate: number): Float32Array {
  if (!origSampleRate || origSampleRate === 16000 || audioData.length === 0) {
    return audioData;
  }
  const ratio = origSampleRate / 16000;
  const newLength = Math.round(audioData.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const origIndex = i * ratio;
    const indexFloor = Math.floor(origIndex);
    const indexCeil = Math.min(audioData.length - 1, Math.ceil(origIndex));
    const fraction = origIndex - indexFloor;
    result[i] = audioData[indexFloor] * (1 - fraction) + audioData[indexCeil] * fraction;
  }
  return result;
}
