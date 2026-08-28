"use client";

// Speech to text, via the browser (#29).
//
// The Web Speech API rather than an ElevenLabs endpoint: it is free, runs
// on-device, adds no round trip, and needs no quota. It is also not universal —
// Chrome and Edge have it, Firefox does not — so `supported` is exposed and
// every caller must offer typing as an equal path rather than a fallback for
// the unlucky.

import { useCallback, useEffect, useRef, useState } from "react";

// Minimal shape of the vendor-prefixed API. TypeScript's DOM lib does not
// declare it, and pulling a whole ambient-types package for six fields is
// more dependency than this needs.
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type Ctor = new () => SpeechRecognitionLike;

function getConstructor(): Ctor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useMicrophone(onTranscript: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Held in a ref so restarting recognition does not need a new instance
  // wired to a stale closure over `onTranscript`.
  const callbackRef = useRef(onTranscript);
  callbackRef.current = onTranscript;

  useEffect(() => {
    setSupported(getConstructor() !== null);
    return () => recognitionRef.current?.abort();
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getConstructor();
    if (!Ctor) {
      setError("This browser cannot listen. Type your question instead.");
      return;
    }

    setError(null);
    const recognition = new Ctor();
    recognition.lang = "en-IN";
    // One question at a time. Continuous mode keeps the microphone open and
    // picks up the assistant's own reply, which then loops.
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript;
      if (text) callbackRef.current(text);
    };
    recognition.onerror = (event) => {
      setError(
        event.error === "not-allowed"
          ? "Microphone permission was denied. Type your question instead."
          : event.error === "no-speech"
            ? "I didn't catch that."
            : `Microphone error: ${event.error}`,
      );
      setListening(false);
    };
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      // Calling start() twice throws; treat it as already listening.
      setListening(true);
    }
  }, []);

  return { start, stop, listening, supported, error };
}
