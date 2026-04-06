import { CredentialAlgorithm, CredentialType } from "../metadata";

/** The kind of credential to generate using a compound configuration. */
// FIXME: extend the preferences to include a preferred forwarder
export type CredentialPreference = {
  [Key in CredentialType]: {
    algorithm: CredentialAlgorithm;
    updated: Date;
  };
};
