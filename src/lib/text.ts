/**
 * Unicode text normalization for Phase 8 Pashto support.
 *
 * Pashto and Arabic-script text entered by shopkeepers can vary in ways that
 * break exact and substring matching:
 *   - Arabic yeh (ي) vs Pashto/Arabic yeh (ی)
 *   - Arabic kaf (ك) vs Pashto kaf (ک)
 *   - Zero-width non-joiner (U+200C) and tatweel (U+0640) inserted between letters
 *   - Arabic-Indic digits (۰۱۲۳۴۵۶۷۸۹) vs Arabic digits (٠١٢٣٤٥٦٧٨٩)
 *   - Pashto-specific letters such as ښ, ږ, ډ, ړ, ټ, ڼ
 *
 * These helpers fold input so search, duplicate detection, and assistant
 * resolution match regardless of variant. Money parsing still requires
 * Arabic-Indic digits after conversion.
 */

const PERSIAN_ARABIC_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

const DIGIT_MAP: Record<string, string> = {};

for (let i = 0; i < 10; i += 1) {
  const persian = PERSIAN_ARABIC_DIGITS[i];
  const arabic = ARABIC_INDIC_DIGITS[i];

  if (persian !== undefined && arabic !== undefined) {
    DIGIT_MAP[persian] = String(i);
    DIGIT_MAP[arabic] = String(i);
  }
}

/** Character variants folded to a single representative for matching. */
const VARIANT_MAP: Record<string, string> = {
  // yeh variants
  "\u06CC": "\u064A", // ی -> ي
  // kaf variants
  "\u06A9": "\u0643", // ک -> ك
  // heh variants
  "\u06C1": "\u0647", // ہ -> ه
  // Remove zero-width joiner/non-joiner and tatweel by mapping to empty.
  "\u200C": "", // ZWNJ
  "\u200D": "", // ZWJ
  "\u0640": "", // tatweel
};

/** Combining diacritic marks (Arabic/Pashto) to strip. */
const DIACRITIC_RE = /[\u064B-\u065F\u0670]/g;

/**
 * Normalize user-entered text for matching.
 *
 * Steps:
 *  1. Unicode NFKC normalization (canonical + compatibility decomposition).
 *  2. Strip zero-width joiners/non-joiners and tatweel.
 *  3. Strip Arabic/Pashto combining diacritics.
 *  4. Fold character variants (ي/ی, ك/ک, ہ/ه).
 *  5. Convert Arabic/Persian-Indic digits to ASCII digits.
 *  6. Collapse whitespace and trim.
 */
export function normalizeText(value: string): string {
  let s = value.normalize("NFKC");

  s = s.replace(/[\u200C\u200D\u0640]/g, "");

  s = s.replace(DIACRITIC_RE, "");

  s = s.replace(/[\u06CC\u06A9\u06C1]/g, (ch) => VARIANT_MAP[ch] ?? ch);

  s = s.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (ch) => DIGIT_MAP[ch] ?? ch);

  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Convert Arabic/Persian-Indic digits in a string to ASCII digits, leaving
 * everything else unchanged. Used for money and quantity fields so users can
 * type ۵۰۰ and have it read as 500.
 */
export function normalizeDigits(value: string): string {
  return value.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (ch) => DIGIT_MAP[ch] ?? ch);
}

/** Detect whether a string contains any Arabic-script characters. */
export function containsArabicScript(value: string): boolean {
  return /[\u0600-\u06FF]/.test(value);
}

/**
 * Normalize a phone number used as a login name: convert Arabic/Persian-Indic
 * digits and remove spaces, dashes, and parentheses. A leading `+` is kept.
 * "0300 123-4567" and "03001234567" both become "03001234567".
 */
export function normalizePhone(value: string): string {
  return normalizeDigits(value).replace(/[\s\-()]/g, "");
}
