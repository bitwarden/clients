import { CredentialAlgorithm, CredentialType, ForwarderExtensionId } from "../metadata";

type AlgorithmPreference = {
  algorithm: CredentialAlgorithm;
  updated: Date;
};

/** The kind of credential to generate using a compound configuration. */
export type CredentialPreference = {
  [Key in CredentialType]: AlgorithmPreference;
} & {
  email: AlgorithmPreference & {
    forwarder?: ForwarderExtensionId;
  };
};
