import { CredentialAlgorithm, CredentialType } from "../metadata";

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
  type: CredentialType;

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
