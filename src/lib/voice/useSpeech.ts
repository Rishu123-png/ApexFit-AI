'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Web Speech API hook with honest state: unsupported browsers, denied
 * permission and recognition failures are all surfaced, never hidden.
 * Typed controls always remain as a fallback (see VoiceControl UI).
 */

// Minimal vendor-prefixed typings (lib.dom lacks SpeechRecognition).
interface SRResultItem { transcript: string; confidence: number }
interface SRResult { 0: SRResultItem; isFinal: boolean }
interface SREvent { resultIndex: number; results: { length: number; [i: number]: SRResult } }
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

export type SpeechState =
  | { kind: 'idle' }
  | { kind: 'listening'; partial?: string }
  | { kind: 'processing' }
  | { kind: 'unsupported' }
  | { kind: 'denied' }
  | { kind: 'error'; message: string };

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function useSpeechRecognition(opts: { onTranscript: (text: string) => void; lang?: string }) {
  const [state, setState] = useState<SpeechState>({ kind: 'idle' });
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const onTranscriptRef = useRef(opts.onTranscript);
  onTranscriptRef.current = opts.onTranscript;

  useEffect(() => () => recRef.current?.abort(), []);

  const start = useCallback(() => {
    if (!isSpeechSupported()) {
      setState({ kind: 'unsupported' });
      return;
    }
    try {
      recRef.current?.abort();
      const Ctor = (window.SpeechRecognition ?? window.webkitSpeechRecognition)!;
      const rec = new Ctor();
      recRef.current = rec;
      rec.lang = opts.lang ?? 'en-IN';
      rec.continuous = false;
      rec.interimResults = true; // stream partial words so the user can SEE the mic hearing them
      rec.maxAlternatives = 1;

      rec.onresult = (e) => {
        const item = e.results[e.resultIndex];
        const text = item?.[0]?.transcript ?? '';
        if (item?.isFinal) {
          if (text.trim()) onTranscriptRef.current(text.trim());
          setState({ kind: 'idle' });
        } else if (text.trim()) {
          setState({ kind: 'listening', partial: text.trim() });
        }
      };
      rec.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          setState({ kind: 'denied' });
        } else if (e.error === 'no-speech') {
          setState({ kind: 'error', message: 'Didn’t catch that — try again.' });
        } else if (e.error === 'network') {
          setState({ kind: 'error', message: 'Speech service unreachable (network).' });
        } else {
          setState({ kind: 'error', message: 'Speech recognition failed.' });
        }
      };
      rec.onend = () => {
        setState((s) => (s.kind === 'listening' ? { kind: 'idle' } : s));
      };

      setState({ kind: 'listening' });
      rec.start();
    } catch {
      setState({ kind: 'error', message: 'Couldn’t start the microphone.' });
    }
  }, [opts.lang]);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } finally {
      setState({ kind: 'idle' });
    }
  }, []);

  return { state, start, stop, supported: isSpeechSupported() };
}

/** Speak a short status line (best-effort; silent failure is fine). */
export function speak(text: string): void {
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.02;
      window.speechSynthesis.speak(u);
    }
  } catch {
    /* TTS unavailable — ignore */
  }
}
