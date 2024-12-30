// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ZXCVBNResult } from "zxcvbn";

export abstract class PasswordStrengthServiceAbstraction {
  getPasswordStrength: (password: string, email?: string, userInputs?: string[]) => ZXCVBNResult;
}
