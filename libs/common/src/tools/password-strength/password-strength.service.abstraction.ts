import { ZXCVBNResult } from "zxcvbn";

export abstract class PasswordStrengthServiceAbstraction {
  abstract getPasswordStrength(
    password: string,
    email?: string,
    userInputs?: string[],
  ): ZXCVBNResult;
}
