// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import zxcvbn from "zxcvbn";

import { PasswordStrengthServiceAbstraction } from "./password-strength.service.abstraction";

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
    const result = zxcvbn(password, finalUserInputs);
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
