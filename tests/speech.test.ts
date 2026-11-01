/**
 * Tests for src/lib/speech.ts — Web Speech API wrapper for Phase 9 voice input.
 *
 * Tests run in Node (vitest `environment: "node"`), so `window` is not
 * defined by default. We mock `window.SpeechRecognition` to simulate a
 * capable browser, and test the unsupported path by deleting `window`.
 */

import { afterEach, describe, expect, it } from "vitest";

import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
} from "@/lib/speech";

function installSpeechRecognition(mockCtor: unknown): void {
  // @ts-expect-error - window is not defined in Node test environment
  globalThis.window = {
    SpeechRecognition: mockCtor,
  } as unknown as Window;
}

function uninstallWindow(): void {
  // @ts-expect-error - window is not defined in Node test environment
  delete globalThis.window;
}

function makeMockRecognition(): Record<string, unknown> {
  const handlers: Record<string, unknown> = {};

  return {
    continuous: false,
    interimResults: true,
    lang: "en-US",
    maxAlternatives: 1,
    start: () => {
      // no-op
    },
    stop: () => {
      // no-op
    },
    abort: () => {
      // no-op
    },
    set onstart(handler: unknown) {
      handlers.onstart = handler;
    },
    get onstart() {
      return handlers.onstart;
    },
    set onend(handler: unknown) {
      handlers.onend = handler;
    },
    get onend() {
      return handlers.onend;
    },
    set onerror(handler: unknown) {
      handlers.onerror = handler;
    },
    get onerror() {
      return handlers.onerror;
    },
    set onresult(handler: unknown) {
      handlers.onresult = handler;
    },
    get onresult() {
      return handlers.onresult;
    },
    handlers,
    fireResult(transcript: string, isFinal: boolean): void {
      if (typeof handlers.onresult === "function") {
        (handlers.onresult as (event: unknown) => void)({
          results: [
            {
              isFinal,
              0: { transcript },
            },
          ],
        });
      }
    },
    fireError(error: string): void {
      if (typeof handlers.onerror === "function") {
        (handlers.onerror as (event: unknown) => void)({ error });
      }
    },
  } as unknown as Record<string, unknown>;
}

describe("isSpeechRecognitionSupported", () => {
  afterEach(() => {
    uninstallWindow();
  });

  it("returns false when window is undefined", () => {
    expect(isSpeechRecognitionSupported()).toBe(false);
  });

  it("returns false when SpeechRecognition is not defined", () => {
    // @ts-expect-error - window is not defined in Node test environment
    globalThis.window = {} as unknown as Window;

    expect(isSpeechRecognitionSupported()).toBe(false);
  });

  it("returns true when SpeechRecognition is defined", () => {
    installSpeechRecognition(class {});

    expect(isSpeechRecognitionSupported()).toBe(true);
  });

  it("returns true when webkitSpeechRecognition is defined", () => {
    // @ts-expect-error - window is not defined in Node test environment
    globalThis.window = {
      webkitSpeechRecognition: class {},
    } as unknown as Window;

    expect(isSpeechRecognitionSupported()).toBe(true);
  });
});

describe("createSpeechRecognition", () => {
  afterEach(() => {
    uninstallWindow();
  });

  it("returns null when speech recognition is not supported", () => {
    expect(createSpeechRecognition()).toBeNull();
  });

  it("returns an instance with the given options when supported", () => {
    const mockCtor = class {
      continuous = false;
      interimResults = true;
      lang = "en-US";
      maxAlternatives = 1;
      start = () => {};
      stop = () => {};
      abort = () => {};
      onresult: ((event: unknown) => void) | null = null;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
    };

    installSpeechRecognition(mockCtor);

    const recognition = createSpeechRecognition(
      { lang: "ps-PK", continuous: true, interimResults: false, maxAlternatives: 3 },
      {
        onStart: () => {},
        onEnd: () => {},
        onError: () => {},
        onResult: () => {},
      },
    );

    expect(recognition).not.toBeNull();
    if (!recognition) {
      return;
    }

    expect(recognition.lang).toBe("ps-PK");
    expect(recognition.continuous).toBe(true);
    expect(recognition.interimResults).toBe(false);
    expect(recognition.maxAlternatives).toBe(3);
  });

  it("fires onResult with transcript and isFinal", () => {
    const recognition = makeMockRecognition();

    installSpeechRecognition(
      class {
        constructor() {
          Object.assign(this, recognition);
        }
      },
    );

    const received: Array<{ transcript: string; isFinal: boolean }> = [];
    const created = createSpeechRecognition(
      { lang: "en-US" },
      {
        onResult: (event) => {
          received.push(event);
        },
      },
    );

    expect(created).not.toBeNull();
    if (!created) {
      return;
    }

    // Simulate the browser firing a result event.
    (created.onresult as (event: unknown) => void)?.({
      results: [
        {
          isFinal: true,
          0: { transcript: "how much did i sell today" },
        },
      ],
    });

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({
      transcript: "how much did i sell today",
      isFinal: true,
    });
  });

  it("fires onError with the error message", () => {
    const recognition = makeMockRecognition();

    installSpeechRecognition(
      class {
        constructor() {
          Object.assign(this, recognition);
        }
      },
    );

    const receivedErrors: Array<string> = [];
    const created = createSpeechRecognition(
      { lang: "en-US" },
      {
        onError: (error) => {
          receivedErrors.push(error);
        },
      },
    );

    expect(created).not.toBeNull();
    if (!created) {
      return;
    }

    (created.onerror as (event: unknown) => void)?.({ error: "no-speech" });

    expect(receivedErrors).toEqual(["no-speech"]);
  });

  it("uses default options when none are provided", () => {
    const recognition = makeMockRecognition();

    installSpeechRecognition(
      class {
        constructor() {
          Object.assign(this, recognition);
        }
      },
    );

    const created = createSpeechRecognition();

    expect(created).not.toBeNull();
    if (!created) {
      return;
    }

    expect(created.lang).toBe("en-US");
    expect(created.continuous).toBe(false);
    expect(created.interimResults).toBe(true);
    expect(created.maxAlternatives).toBe(1);
  });
});
