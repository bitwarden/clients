import { GENERATOR_DISK, UserKeyDefinition } from "@bitwarden/common/platform/state";

import { DefaultCredentialPreferences } from "../data";
import { CredentialPreference } from "../types";

/** plaintext password generation options */
export const PREFERENCES = new UserKeyDefinition<CredentialPreference>(
  GENERATOR_DISK,
  "credentialPreferences",
  {
    deserializer: (value) => {
      const result = (value as any) ?? {};

      for (const key in DefaultCredentialPreferences) {
        // bind `key` to `category` to transmute the type
        const category: keyof typeof DefaultCredentialPreferences = key as any;

        const preference = result[category] ?? { ...DefaultCredentialPreferences[category] };
        if (typeof preference.updated === "string") {
          preference.updated = new Date(preference.updated);
        }

        result[category] = preference;
      }

      return result;
    },
    clearOn: ["logout"],
  },
);
