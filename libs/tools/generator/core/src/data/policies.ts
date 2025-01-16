import {
  PassphraseGenerationOptions,
  PassphraseGeneratorPolicy,
  PasswordGenerationOptions,
  PasswordGeneratorPolicy,
  PolicyConfiguration,
} from "../types";

import { Generators } from "./generators";

/** Policy configurations
 *  @deprecated use Generator.*.policy instead
 */
export const Policies = Object.freeze({
  Passphrase: Generators.passphrase.policy,
  Password: Generators.password.policy,
} satisfies {
  /** Passphrase policy configuration */
  Passphrase: PolicyConfiguration<PassphraseGeneratorPolicy, PassphraseGenerationOptions>;

  /** Password policy configuration */
  Password: PolicyConfiguration<PasswordGeneratorPolicy, PasswordGenerationOptions>;
});
