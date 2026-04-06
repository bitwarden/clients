import { PassphraseGenerationOptions } from "../types";

/** The default options for passphrase generation. */
export const DefaultPassphraseGenerationOptions: Partial<PassphraseGenerationOptions> =
  Object.freeze({
    numWords: 6,
    wordSeparator: "-",
    capitalize: false,
    includeNumber: false,
  });
