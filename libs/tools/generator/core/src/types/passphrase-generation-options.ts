/** Request format for passphrase credential generation.
 *  The members of this type may be `undefined` when the user is
 *  generating a password.
 */
export type PassphraseGenerationOptions = {
  /** The number of words to include in the passphrase.
   * This value defaults to 3.
   */
  numWords?: number;

  /** The ASCII separator character to use between words in the passphrase.
   * This value defaults to a dash.
   * If multiple characters appear in the string, only the first character is used.
   */
  wordSeparator?: string;

  /** `true` when the first character of every word should be capitalized.
   * This value defaults to `false`.
   */
  capitalize?: boolean;

  /** `true` when a number should be included in the passphrase.
   * This value defaults to `false`.
   */
  includeNumber?: boolean;
};
