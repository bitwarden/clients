/** Settings format for password credential generation.
 */
export type PasswordGeneratorSettings = {
  /** The length of the password selected by the user */
  length?: number;

  /** `true` when ambiguous characters may be included in the output.
   *  `false` when ambiguous characters should not be included in the output.
   */
  ambiguous?: boolean;

  /** `true` when uppercase ASCII characters should be included in the output
   * This value defaults to `false.
   */
  uppercase?: boolean;

  /** The minimum number of uppercase characters to include in the output.
   *  The value is ignored when `uppercase` is `false`.
   *  The value defaults to 1 when `uppercase` is `true`.
   */
  minUppercase?: number;

  /** `true` when lowercase ASCII characters should be included in the output.
   * This value defaults to `false`.
   */
  lowercase?: boolean;

  /** The minimum number of lowercase characters to include in the output.
   * The value defaults to 1 when `lowercase` is `true`.
   * The value defaults to 0 when `lowercase` is `false`.
   */
  minLowercase?: number;

  /** Whether or not to include ASCII digits in the output
   * This value defaults to `true` when `minNumber` is at least 1.
   * This value defaults to `false` when `minNumber` is less than 1.
   */
  number?: boolean;

  /** The minimum number of digits to include in the output.
   * The value defaults to 1 when `number` is `true`.
   * The value defaults to 0 when `number` is `false`.
   */
  minNumber?: number;

  /** Whether or not to include special characters in the output.
   * This value defaults to `true` when `minSpecial` is at least 1.
   * This value defaults to `false` when `minSpecial` is less than 1.
   */
  special?: boolean;

  /** The minimum number of special characters to include in the output.
   * This value defaults to 1 when `special` is `true`.
   * This value defaults to 0 when `special` is `false`.
   */
  minSpecial?: number;
};

/** Request format for password credential generation.
 *  All members of this type may be `undefined` when the user is
 *  generating a passphrase.
 *
 * @remarks The name of this type is a bit of a misnomer. This type
 *          it is used with the "password generator" types. The name
 *          `PasswordGeneratorOptions` is already in use by legacy code.
 */
export type PasswordGenerationOptions = Partial<PasswordGeneratorSettings> & {
  /** The minimum length of the password. This defaults to 5, and increases
   * to ensure `minLength` is at least as large as the sum of the other minimums.
   */
  minLength?: number;
};
