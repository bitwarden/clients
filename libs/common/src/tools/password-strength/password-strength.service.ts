// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import zxcvbn from "zxcvbn";

import { PasswordStrengthServiceAbstraction } from "./password-strength.service.abstraction";

/**
 * Maximum number of characters scored by zxcvbn. Longer inputs are truncated to this length before
 * scoring to avoid blocking the UI — zxcvbn is O(n²) in input length and runs synchronously. A
 * prefix this long already saturates the top score, so truncation never downgrades a real password.
 *
 * Set above the password generator's maximum length (128) for headroom.
 */
export const MAX_PASSWORD_STRENGTH_LENGTH = 256;

export class PasswordStrengthService implements PasswordStrengthServiceAbstraction {
  /**
   * Calculates a password strength score using zxcvbn.
   * @param password The password to calculate the strength of.
   * @param emailInput An unparsed email address to use as user input.
   * @param userInputs An array of additional user inputs to use when calculating the strength.
   */
  getPasswordStrength(
    password: string,
    emailInput: string = null,
    userInputs: string[] = null,
  ): zxcvbn.ZXCVBNResult {
    if (password == null || password.length === 0) {
      return null;
    }
    const globalUserInputs = [
      "bitwarden",
      "bit",
      "warden",
      ...(userInputs ?? []),
      ...this.emailToUserInputs(emailInput),
    ];
    // Use a hash set to get rid of any duplicate user inputs
    const finalUserInputs = Array.from(new Set(globalUserInputs));
    // Cap the scored length to keep zxcvbn's O(n²) work bounded on oversized inputs.
    const scoredPassword =
      password.length > MAX_PASSWORD_STRENGTH_LENGTH
        ? password.substring(0, MAX_PASSWORD_STRENGTH_LENGTH)
        : password;
    const result = zxcvbn(scoredPassword, finalUserInputs);
    return result;
  }

  /**
   * Convert an email address into a list of user inputs for zxcvbn by
   * taking the local part of the email address and splitting it into words.
   * @param email
   * @private
   */
  private emailToUserInputs(email: string): string[] {
    if (email == null || email.length === 0) {
      return [];
    }
    const atPosition = email.indexOf("@");
    if (atPosition < 0) {
      return [];
    }
    return email
      .substring(0, atPosition)
      .trim()
      .toLowerCase()
      .split(/[^A-Za-z0-9]/);
  }
}
