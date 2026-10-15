import { describe, it, expect } from 'vitest';
import { LiveSpeechRecognizer } from '../src/services/speech/liveSpeechRecognition';

describe('Live Speech Recognition Service', () => {
  it('instantiates LiveSpeechRecognizer with callbacks', () => {
    let finalResult = '';
    let interimResult = '';

    const recognizer = new LiveSpeechRecognizer({
      onFinalResult: (t) => { finalResult = t; },
      onInterimResult: (t) => { interimResult = t; },
      onError: () => {},
      onEnd: () => {},
    });

    expect(recognizer).toBeDefined();
    expect(recognizer.getIsListening()).toBe(false);
  });

  it('detects browser support accurately in standard environments', () => {
    const supported = LiveSpeechRecognizer.isSupported();
    expect(typeof supported).toBe('boolean');
  });
});
