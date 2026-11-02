"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createSpeechRecognition, isSpeechRecognitionSupported } from "@/lib/speech";
import { readClientLocale } from "@/lib/dictionary";

export type SpeechRecognitionHook = {
  /** Whether the browser supports speech recognition. */
  isSupported: boolean;
  /** Whether recognition is currently listening. */
  isListening: boolean;
  /** Current interim transcript (updated while speaking). */
  transcript: string;
  /** Final transcript, ready to submit. Cleared after submission. */
  finalTranscript: string;
  /** Error message, if recognition failed. */
  error: string | null;
  /** Start listening. */
  start: () => void;
  /** Stop listening. */
  stop: () => void;
  /** Clear the final transcript after submitting it. */
  clearFinal: () => void;
};

/** Map app locale to a BCP-47 recognition language tag. */
function localeToLang(locale: string): string {
  return locale === "ps" ? "ps-PK" : "en-US";
}

/**
 * Hook that wraps the browser's Web Speech API for voice input.
 *
 * Returns null-safe values when speech recognition is not supported.
 * Audio stays on the laptop; no cloud transcription provider is used.
 */
export function useSpeechRecognition(): SpeechRecognitionHook {
  const [isSupported] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return isSpeechRecognitionSupported();
  });
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<ReturnType<typeof createSpeechRecognition> | null>(
    null,
  );

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    recognitionRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const start = useCallback(() => {
    if (!isSupported || isListening) {
      return;
    }

    const locale = readClientLocale();
    const recognition = createSpeechRecognition(
      {
        lang: localeToLang(locale),
        continuous: false,
        interimResults: true,
        maxAlternatives: 1,
      },
      {
        onStart: () => {
          setIsListening(true);
          setError(null);
          setTranscript("");
          setFinalTranscript("");
        },
        onEnd: () => {
          setIsListening(false);
          recognitionRef.current = null;
        },
        onError: (err) => {
          setError(err);
          setIsListening(false);
          recognitionRef.current = null;
        },
        onResult: (event) => {
          setTranscript(event.transcript);
          if (event.isFinal) {
            setFinalTranscript(event.transcript);
          }
        },
      },
    );

    if (!recognition) {
      setError("Speech recognition is not available.");
      return;
    }

    recognitionRef.current = recognition;
    recognition.start();
  }, [isSupported, isListening]);

  const clearFinal = useCallback(() => {
    setFinalTranscript("");
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    finalTranscript,
    error,
    start,
    stop,
    clearFinal,
  };
}
