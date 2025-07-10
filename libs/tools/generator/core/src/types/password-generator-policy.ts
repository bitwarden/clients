/** Policy options enforced during password generation. */
export type PasswordGeneratorPolicy = {
  /** The minimum length of generated passwords.
   *  When this is less than or equal to zero, it is ignored.
   *  If this is less than the total number of characters required by
   *  the policy's other settings, then it is ignored.
   */
  minLength: number;

  /** When this is true, an uppercase character must be part of
   *  the generated password.
   */
  useUppercase: boolean;

  /** When this is true, a lowercase character must be part of
   *  the generated password.
   */
  useLowercase: boolean;

  /** When this is true, at least one digit must be part of the generated
   *  password.
   */
  useNumbers: boolean;

  /** The quantity of digits to include in the generated password.
   *  When this is less than or equal to zero, it is ignored.
   */
  numberCount: number;

  /** When this is true, at least one digit must be part of the generated
   *  password.
   */
  useSpecial: boolean;

  /** The quantity of special characters to include in the generated
   *  password. When this is less than or equal to zero, it is ignored.
   */
  specialCount: number;
};
