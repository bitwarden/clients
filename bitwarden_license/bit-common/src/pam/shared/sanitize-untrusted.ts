/** The default cap for text a server or a vault supplied. */
export const DEFAULT_UNTRUSTED_MAX_LENGTH = 200;

/** Line breaks and tabs become one space, so words on either side of them stay apart. */
const WHITESPACE_CONTROLS = /[\t\n\r\v\f\u0085\u{2028}\u{2029}]+/gu;

/**
 * Every other C0 and C1 control (which covers the escape character behind terminal sequences),
 * the bidirectional overrides, isolates and Arabic letter mark that reorder printed text, and
 * zero-width and invisible format characters (word joiner, invisible operators, Mongolian vowel
 * separator).
 */
const OTHER_CONTROLS =
  // eslint-disable-next-line no-control-regex -- matching control characters is the purpose
  /[\u0000-\u001F\u007F-\u009F\u{061C}\u{180E}\u{200B}-\u{200F}\u{202A}-\u{202E}\u{2060}-\u{2064}\u{2066}-\u{2069}\u{FEFF}]/gu;

/**
 * Makes text from the server or the vault safe to print: control characters are removed and the
 * result is cut to `maxLength` characters, ending in an ellipsis when it was cut. Use it for
 * `failureReason` and any other free text that is not from this code. Never throws.
 */
export function sanitizeUntrusted(
  text: string | null | undefined,
  maxLength: number = DEFAULT_UNTRUSTED_MAX_LENGTH,
): string {
  if (text == null) {
    return "";
  }
  const cleaned = String(text).replace(WHITESPACE_CONTROLS, " ").replace(OTHER_CONTROLS, "").trim();
  const limit = Math.max(1, Math.floor(maxLength));
  const characters = Array.from(cleaned);
  return characters.length > limit ? `${characters.slice(0, limit - 1).join("")}…` : cleaned;
}
