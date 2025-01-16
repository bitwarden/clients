// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";

import { PasswordGeneratorPolicyOptions } from "@bitwarden/common/admin-console/models/domain/password-generator-policy-options";
import { GeneratedPasswordHistory } from "@bitwarden/generator-history";

import { PasswordGeneratorOptions } from "./password-generator-options";

/** @deprecated Use {@link GeneratorService} with a password or passphrase {@link GeneratorStrategy} instead. */
export abstract class PasswordGenerationServiceAbstraction {
  generatePassword: (options: PasswordGeneratorOptions) => Promise<string>;
  generatePassphrase: (options: PasswordGeneratorOptions) => Promise<string>;
  getOptions: () => Promise<[PasswordGeneratorOptions, PasswordGeneratorPolicyOptions]>;
  getOptions$: () => Observable<[PasswordGeneratorOptions, PasswordGeneratorPolicyOptions]>;
  enforcePasswordGeneratorPoliciesOnOptions: (
    options: PasswordGeneratorOptions,
  ) => Promise<[PasswordGeneratorOptions, PasswordGeneratorPolicyOptions]>;
  saveOptions: (options: PasswordGeneratorOptions) => Promise<void>;
  getHistory: () => Promise<GeneratedPasswordHistory[]>;
  addHistory: (password: string) => Promise<void>;
  clear: (userId?: string) => Promise<GeneratedPasswordHistory[]>;
}
