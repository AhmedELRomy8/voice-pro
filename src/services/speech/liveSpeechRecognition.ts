// Live Streaming Speech Recognition with Real-Time Interim Results & Resilient Lifecycle

export interface LiveSpeechCallbacks {
  onInterimResult: (interimText: string) => void;
  onFinalResult: (finalText: string) => void;
  onError: (errorMsg: string, isNetworkError?: boolean) => void;
  onEnd: () => void;
  onStart?: () => void;
}

export class LiveSpeechRecognizer {
  private recognition: any = null;
  private isListening = false;
  private isManuallyStopped = false;
  private lang = 'ar-EG';
  private callbacks: LiveSpeechCallbacks;
  private restartTimeout: any = null;
  private consecutiveErrors = 0;

  constructor(callbacks: LiveSpeechCallbacks) {
    this.callbacks = callbacks;
  }

  public static isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    );
  }

  public start(lang = 'ar-EG'): void {
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      this.callbacks.onError(
        'متصفحك لا يدعم خاصية الإملاء المباشر عبر الويب. يرجى استخدام متصفح Chrome أو Edge أو استخدام الوضع المحلي (Whisper).'
      );
      return;
    }

    this.stop(); // Clean up any existing instance first
    this.lang = lang;
    this.isManuallyStopped = false;
    this.consecutiveErrors = 0;

    try {
      this.recognition = new SpeechRecognitionClass();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.lang;
      this.recognition.maxAlternatives = 1;

      this.recognition.onstart = () => {
        this.isListening = true;
        this.consecutiveErrors = 0;
        if (this.callbacks.onStart) {
          this.callbacks.onStart();
        }
      };

      this.recognition.onresult = (event: any) => {
        this.consecutiveErrors = 0;
        let interimTranscript = '';
        let finalChunk = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (!item || !item[0]) continue;
          const transcript = item[0].transcript;
          if (item.isFinal) {
            finalChunk += `${transcript} `;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalChunk.trim()) {
          this.callbacks.onFinalResult(finalChunk);
        }
        this.callbacks.onInterimResult(interimTranscript);
      };

      this.recognition.onerror = (event: any) => {
        const error = event.error;

        // 'no-speech' is non-fatal when user pauses talking
        if (error === 'no-speech') {
          return;
        }

        // 'aborted' is intentional when stopped
        if (error === 'aborted') {
          return;
        }

        if (error === 'not-allowed') {
          this.isManuallyStopped = true;
          this.callbacks.onError(
            'تم حظر إذن الميكروفون. يرجى النقر على أيقونة القفل أو الميكروفون في شريط عنوان المتصفح واختيار "السماح" (Allow).'
          );
          return;
        }

        if (error === 'audio-capture') {
          this.isManuallyStopped = true;
          this.callbacks.onError(
            'تعذر التقاط الصوت. تأكد من توصيل الميكروفون بشكل صحيح وإلغاء كتم الصوت.'
          );
          return;
        }

        if (error === 'network') {
          this.consecutiveErrors++;
          if (this.consecutiveErrors >= 2) {
            this.isManuallyStopped = true;
            this.callbacks.onError(
              'تعذر الاتصال بخدمة التعرف الصوتي السحابية (خطأ في الشبكة أو حجب من مزود الإنترنت). يمكنك استخدام وضع Whisper المحلي المضمون 100% بدون إنترنت.',
              true
            );
          }
          return;
        }

        this.callbacks.onError(`خطأ في التعرف الصوتي: ${error}`);
      };

      this.recognition.onend = () => {
        this.isListening = false;

        // Auto-restart if Chrome naturally ended the utterance session and user hasn't stopped
        if (!this.isManuallyStopped && this.consecutiveErrors < 2) {
          this.restartTimeout = setTimeout(() => {
            if (!this.isManuallyStopped && this.recognition) {
              try {
                this.recognition.start();
              } catch {
                this.callbacks.onEnd();
              }
            }
          }, 300);
        } else {
          this.callbacks.onEnd();
        }
      };

      this.recognition.start();
    } catch (err: any) {
      this.callbacks.onError(`تعذر بدء الإملاء الصوتي: ${err.message || err}`);
    }
  }

  public stop(): void {
    this.isManuallyStopped = true;
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
      this.recognition = null;
    }
    this.isListening = false;
  }

  public getIsListening(): boolean {
    return this.isListening;
  }
}

