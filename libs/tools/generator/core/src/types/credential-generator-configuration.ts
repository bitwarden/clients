import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserKeyDefinition } from "@bitwarden/common/platform/state";
import { RestClient } from "@bitwarden/common/tools/integration/rpc";
import { ObjectKey } from "@bitwarden/common/tools/state/object-key";
import { Constraints } from "@bitwarden/common/tools/types";

import { Randomizer } from "../abstractions";
import { CredentialAlgorithm, CredentialCategory, PolicyConfiguration } from "../types";

import { CredentialGenerator } from "./credential-generator";

export type GeneratorDependencyProvider = {
  randomizer: Randomizer;
  client: RestClient;
  i18nService: I18nService;
};

export type AlgorithmInfo = {
  /** Uniquely identifies the credential configuration
   * @example
   *   // Use `isForwarderIntegration(algorithm: CredentialAlgorithm)`
   *   // to pattern test whether the credential describes a forwarder algorithm
   *   const meta : CredentialGeneratorInfo = // ...
   *   const { forwarder } = isForwarderIntegration(meta.id) ? credentialId : {};
   */
  id: CredentialAlgorithm;

  /** The kind of credential generated by this configuration */
  category: CredentialCategory;

  /** Localized algorithm name */
  name: string;

  /* Localized generate button label */
  generate: string;

  /** Localized "credential generated" informational message */
  onGeneratedMessage: string;

  /* Localized copy button label */
  copy: string;

  /* Localized dialog button label */
  useGeneratedValue: string;

  /* Localized generated value label */
  credentialType: string;

  /** Localized algorithm description */
  description?: string;

  /** When true, credential generation must be explicitly requested.
   *  @remarks this property is useful when credential generation
   *   carries side effects, such as configuring a service external
   *   to Bitwarden.
   */
  onlyOnRequest: boolean;

  /** Well-known fields to display on the options panel or collect from the environment.
   *  @remarks: at present, this is only used by forwarders
   */
  request: readonly string[];
};

/** Credential generator metadata common across credential generators */
export type CredentialGeneratorInfo = {
  /** Uniquely identifies the credential configuration
   * @example
   *   // Use `isForwarderIntegration(algorithm: CredentialAlgorithm)`
   *   // to pattern test whether the credential describes a forwarder algorithm
   *   const meta : CredentialGeneratorInfo = // ...
   *   const { forwarder } = isForwarderIntegration(meta.id) ? credentialId : {};
   */
  id: CredentialAlgorithm;

  /** The kind of credential generated by this configuration */
  category: CredentialCategory;

  /** Localization key for the credential name */
  nameKey: string;

  /** Localization key for the credential description*/
  descriptionKey?: string;

  /** Localization key for the generate command label */
  generateKey: string;

  /** Localization key for the copy button label */
  copyKey: string;

  /** Localization key for the "credential generated" informational message */
  onGeneratedMessageKey: string;

  /** Localized "use generated credential" button label */
  useGeneratedValueKey: string;

  /** Localization key for describing the kind of credential generated
   *  by this generator.
   */
  credentialTypeKey: string;

  /** When true, credential generation must be explicitly requested.
   *  @remarks this property is useful when credential generation
   *   carries side effects, such as configuring a service external
   *   to Bitwarden.
   */
  onlyOnRequest: boolean;

  /** Well-known fields to display on the options panel or collect from the environment.
   *  @remarks: at present, this is only used by forwarders
   */
  request: readonly string[];
};

/** Credential generator metadata that relies upon typed setting and policy definitions.
 * @example
 *   // Use `isForwarderIntegration(algorithm: CredentialAlgorithm)`
 *   // to pattern test whether the credential describes a forwarder algorithm
 *   const meta : CredentialGeneratorInfo = // ...
 *   const { forwarder } = isForwarderIntegration(meta.id) ? credentialId : {};
 */
export type CredentialGeneratorConfiguration<Settings, Policy> = CredentialGeneratorInfo & {
  /** An algorithm that generates credentials when ran. */
  engine: {
    /** Factory for the generator
     */
    // FIXME: note that this erases the engine's type so that credentials are
    // generated uniformly. This property needs to be maintained for
    // the credential generator, but engine configurations should return
    // the underlying type. `create` may be able to do double-duty w/ an
    // engine definition if `CredentialGenerator` can be made covariant.
    create: (randomizer: GeneratorDependencyProvider) => CredentialGenerator<Settings>;
  };
  /** Defines the stored parameters for credential generation */
  settings: {
    /** value used when an account's settings haven't been initialized
     *  @deprecated use `ObjectKey.initial` for your desired storage property instead
     */
    initial: Readonly<Partial<Settings>>;

    /** Application-global constraints that apply to account settings */
    constraints: Constraints<Settings>;

    /** storage location for account-global settings */
    account: UserKeyDefinition<Settings> | ObjectKey<Settings>;

    /** storage location for *plaintext* settings imports */
    import?: UserKeyDefinition<Settings> | ObjectKey<Settings, Record<string, never>, Settings>;
  };

  /** defines how to construct policy for this settings instance */
  policy: PolicyConfiguration<Policy, Settings>;
};
