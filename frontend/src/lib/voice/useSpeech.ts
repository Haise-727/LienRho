"use client";

// Playing audio from /api/voice/speak (#29, #3).
//
// One hook so all three voice surfaces behave identically: same errors, same
// "not configured" handling, same guarantee that starting a new clip stops the
// previous one. Three components each managing their own Audio element is how
// you end up with two voices talking over each other on stage.

import { useCallback, useEffect, useRef, useState } from "react";

export type SpeechState = "idle" | "loading" | "playing" | "error" | "unconfigured";

export function useSpeech() {
  const [state, setState] = useState<SpeechState>("idle");
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  // Survives unmount; a fetch that resolves after the component is gone must
  // not call setState.
  const aliveRef = useRef(true);

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  const stop = useCallback(() => {
    cleanup();
    if (aliveRef.current) setState("idle");
  }, [cleanup]);

  /** Speak `text`. Resolves when playback finishes, or rejects on failure. */
  const speak = useCallback(
    async (text: string) => {
      cleanup();
      if (!aliveRef.current) return;
      setState("loading");
      setError(null);

      try {
        const response = await fetch("/api/voice/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          if (!aliveRef.current) return;
          // 503 means no API key — a setup state, not a failure, and worth
          // saying differently so nobody debugs working code.
          setState(response.status === 503 ? "unconfigured" : "error");
          setError(body?.message ?? `Speech failed (${response.status})`);
          return;
        }

        const blob = await response.blob();
        if (!aliveRef.current) return;

        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;

        await new Promise<void>((resolve, reject) => {
          audio.onended = () => resolve();
          audio.onerror = () => reject(new Error("Audio playback failed"));
          setState("playing");
          // Browsers block autoplay without a user gesture. Every caller is
          // inside a click handler, so this should not fire — but if it does,
          // surface it rather than hanging in "playing" forever.
          audio.play().catch(reject);
        });

        if (aliveRef.current) setState("idle");
      } catch (e) {
        if (!aliveRef.current) return;
        setState("error");
        setError(e instanceof Error ? e.message : "Speech failed");
      }
    },
    [cleanup],
  );

  return {
    speak,
    stop,
    state,
    error,
    isBusy: state === "loading" || state === "playing",
  };
}
