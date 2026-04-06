/** Policy options enforced during passphrase generation. */
export type PassphraseGeneratorPolicy = {
  minNumberWords: number;
  capitalize: boolean;
  includeNumber: boolean;
};
