import { PassphraseGenerationOptions, PasswordGenerationOptions } from "@bitwarden/generator-core";
import { GeneratorNavigation } from "@bitwarden/generator-navigation";

/** Request format for credential generation.
 *  This type includes all properties suitable for reactive data binding.
 */
export type PasswordGeneratorOptions = PasswordGenerationOptions &
  PassphraseGenerationOptions &
  GeneratorNavigation & { policyUpdated?: boolean };
