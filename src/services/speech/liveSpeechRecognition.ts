// Live Streaming Speech Recognition with Real-Time Interim Results

export interface LiveSpeechCallbacks {
  onInterimResult: (interimText: string) => void;
  onFinalResult: (finalText: string) => void;
  onError: (errorMsg: string) => void;
  onEnd: () => void;
}

export class LiveSpeechRecognizer {
  private recognition: any = null;
  private isListening = false;
  private isManuallyStopped = false;
  private lang = 'ar-EG';
  private callbacks: LiveSpeechCallbacks;

  constructor(callbacks: LiveSpeechCallbacks) {
    this.callbacks = callbacks;
  }

  public static isSupported(): boolean {
    return typeof window !== 'undefined' &&
      Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  public start(lang = 'ar-EG'): void {
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      this.callbacks.onError('متصفحك لا يدعم خاصية الإملاء الصوتي المباشر. يرجى استخدام متصفح Chrome أو Edge أو تفعيل الوضع المحلي.');
      return;
    }

    this.lang = lang;
    this.isManuallyStopped = false;

    try {
      this.recognition = new SpeechRecognitionClass();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.lang;
      this.recognition.maxAlternatives = 1;

      this.recognition.onstart = () => {
        this.isListening = true;
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalChunk = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalChunk += `${transcript} `;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalChunk) {
          this.callbacks.onFinalResult(finalChunk);
        }
        this.callbacks.onInterimResult(interimTranscript);
      };

      this.recognition.onerror = (event: any) => {
        // 'no-speech' is non-fatal when continuous
        if (event.error === 'no-speech') return;
        if (event.error === 'not-allowed') {
          this.callbacks.onError('تم رفض الإذن للوصول إلى الميكروفون. يرجى السماح بالوصول من إعدادات المتصفح.');
        } else {
          this.callbacks.onError(`خطأ في التعرف الصوتي: ${event.error}`);
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
        // If not manually stopped, keep listening continuously
        if (!this.isManuallyStopped) {
          try {
            this.recognition.start();
          } catch {
            this.callbacks.onEnd();
          }
        } else {
          this.callbacks.onEnd();
        }
      };

      this.recognition.start();
    } catch (err: any) {
      this.callbacks.onError(`تعذر بدء الإملاء: ${err.message || err}`);
    }
  }

  public stop(): void {
    this.isManuallyStopped = true;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.warn('Error stopping recognition:', e);
      }
      this.recognition = null;
    }
    this.isListening = false;
  }

  public getIsListening(): boolean {
    return this.isListening;
  }
}
