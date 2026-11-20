import { GENERATOR_DISK, UserKeyDefinition } from "@bitwarden/common/platform/state";

import { AlgorithmsByType, CredentialType, Type, isForwarderExtensionId } from "../metadata";
import { CredentialPreference } from "../types";

/** plaintext password generation options */
export const PREFERENCES = new UserKeyDefinition<CredentialPreference>(
  GENERATOR_DISK,
  "credentialPreferences",
  {
    deserializer: (value) => {
      const result = (value as any) ?? {};

      for (const key in AlgorithmsByType) {
        const type = key as CredentialType;
        if (result[type]) {
          result[type].updated = new Date(result[type].updated);
        } else {
          const [algorithm] = AlgorithmsByType[type];
          result[type] = { algorithm, updated: new Date() };
        }
      }

      const email = result[Type.email];
      if (isForwarderExtensionId(email.algorithm)) {
        email.forwarder = email.algorithm;
      }

      return result;
    },
    clearOn: ["logout"],
  },
);
