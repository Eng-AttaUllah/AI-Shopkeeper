/**
 * Speech recognition wrapper for Phase 9 voice input.
 *
 * Uses the browser's Web Speech API (window.SpeechRecognition /
 * window.webkitSpeechRecognition). Audio stays on the laptop; no cloud
 * transcription provider is used.
 *
 * All functions are client-safe: they guard against `window` being
 * undefined (server-side rendering, tests) and return safe defaults.
 */

export type SpeechRecognitionEvent = {
  transcript: string;
  isFinal: boolean;
};

export type SpeechRecognitionState = "idle" | "listening" | "stopped";

export type SpeechRecognitionCallbacks = {
  onResult?: (event: SpeechRecognitionEvent) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
};

export type SpeechRecognitionOptions = {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: unknown) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: unknown) => void) | null;
};

type SpeechRecognitionConstructor = new (...args: unknown[]) => SpeechRecognitionInstance;

function getSpeechRecognitionCtor():
  | SpeechRecognitionConstructor
  | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return (
    (window as unknown as {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    }).SpeechRecognition ??
    (window as unknown as {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    }).webkitSpeechRecognition
  ) as SpeechRecognitionConstructor | undefined;
}

/** Check if the browser supports speech recognition. */
export function isSpeechRecognitionSupported(): boolean {
  return Boolean(getSpeechRecognitionCtor());
}

/**
 * Create a speech recognition instance wired to the given callbacks.
 * Returns null when speech recognition is not supported.
 */
export function createSpeechRecognition(
  options: SpeechRecognitionOptions = {},
  callbacks: SpeechRecognitionCallbacks = {},
): SpeechRecognitionInstance | null {
  const SpeechRecognitionCtor = getSpeechRecognitionCtor();

  if (!SpeechRecognitionCtor) {
    return null;
  }

  const recognition = new SpeechRecognitionCtor();

  recognition.continuous = options.continuous ?? false;
  recognition.interimResults = options.interimResults ?? true;
  recognition.lang = options.lang ?? "en-US";
  recognition.maxAlternatives = options.maxAlternatives ?? 1;

  recognition.onstart = callbacks.onStart ?? null;
  recognition.onend = callbacks.onEnd ?? null;
  recognition.onerror = (event: unknown) => {
    callbacks.onError?.(
      (event as unknown as { error?: string })?.error ?? "recognition error",
    );
  };

  recognition.onresult = (event: unknown) => {
    const results = (event as unknown as {
      results: Array<{
        isFinal: boolean;
        [index: number]: { transcript: string };
      }>;
    }).results;

    if (!results || results.length === 0) {
      return;
    }

    const last = results[results.length - 1];
    if (!last) {
      return;
    }

    const alternative = last[0];
    if (!alternative) {
      return;
    }

    callbacks.onResult?.({
      transcript: alternative.transcript,
      isFinal: last.isFinal,
    });
  };

  return recognition;
}
