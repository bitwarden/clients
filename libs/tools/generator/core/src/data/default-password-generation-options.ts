import { PasswordGenerationOptions, PasswordGeneratorSettings } from "../types";

import { DefaultPasswordBoundaries } from "./default-password-boundaries";

/** The default options for password generation. */
export const DefaultPasswordGenerationOptions: Partial<PasswordGenerationOptions> &
  PasswordGeneratorSettings = Object.freeze({
  length: 14,
  minLength: DefaultPasswordBoundaries.length.min,
  ambiguous: true,
  uppercase: true,
  minUppercase: 1,
  lowercase: true,
  minLowercase: 1,
  number: true,
  minNumber: 1,
  special: false,
  minSpecial: 0,
});
