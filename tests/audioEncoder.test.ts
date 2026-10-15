import { describe, it, expect } from 'vitest';
import { encodeWav } from '../src/services/speech/audioRecorder';

describe('Audio Recorder & WAV Encoder', () => {
  it('encodes empty Float32Array into valid WAV header with 0 samples', async () => {
    const emptySamples = new Float32Array(0);
    const blob = encodeWav(emptySamples, 16000);

    expect(blob).toBeDefined();
    expect(blob.type).toBe('audio/wav');
    expect(blob.size).toBe(44); // 44 bytes standard WAV header

    const buffer = await blob.arrayBuffer();
    const view = new DataView(buffer);

    // Check 'RIFF'
    const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    expect(riff).toBe('RIFF');

    // Check 'WAVE'
    const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
    expect(wave).toBe('WAVE');

    // Check sample rate (16000)
    expect(view.getUint32(24, true)).toBe(16000);

    // Check channels (1 = mono)
    expect(view.getUint16(22, true)).toBe(1);

    // Check bits per sample (16)
    expect(view.getUint16(34, true)).toBe(16);
  });

  it('encodes 1 second of 16kHz audio samples correctly', async () => {
    const sampleRate = 16000;
    const durationSeconds = 1;
    const samples = new Float32Array(sampleRate * durationSeconds);

    // Generate 440Hz sine wave test tone
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate);
    }

    const blob = encodeWav(samples, sampleRate);
    expect(blob.size).toBe(44 + 16000 * 2); // 44 header + 32,000 bytes PCM data
  });

  it('clamps clipped audio values between -1.0 and 1.0 without integer overflow', async () => {
    const samples = new Float32Array([1.5, -2.0, 0.5, -0.5]);
    const blob = encodeWav(samples, 16000);
    const buffer = await blob.arrayBuffer();
    const view = new DataView(buffer);

    // Sample 0 should clamp to +32767 (0x7FFF)
    expect(view.getInt16(44, true)).toBe(0x7fff);

    // Sample 1 should clamp to -32768 (-0x8000)
    expect(view.getInt16(46, true)).toBe(-0x8000);
  });
});
