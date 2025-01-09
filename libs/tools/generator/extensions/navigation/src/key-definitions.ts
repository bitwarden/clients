import { GENERATOR_DISK, UserKeyDefinition } from "@bitwarden/common/platform/state";

import { GeneratorNavigation } from "./generator-navigation";

/** plaintext password generation options */
export const GENERATOR_SETTINGS = new UserKeyDefinition<GeneratorNavigation>(
  GENERATOR_DISK,
  "generatorSettings",
  {
    deserializer: (value) => value,
    clearOn: ["logout"],
  },
);
