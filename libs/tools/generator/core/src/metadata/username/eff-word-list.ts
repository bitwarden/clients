import { GENERATOR_DISK } from "@bitwarden/common/platform/state";
import { PublicClassifier } from "@bitwarden/common/tools/public-classifier";
import { IdentityConstraint } from "@bitwarden/common/tools/state/identity-state-constraint";
import { deepFreeze } from "@bitwarden/common/tools/util";

import { UsernameRandomizer } from "../../engine";
import { GeneratorDependencyProvider } from "../../providers";
import { CredentialGenerator, EffUsernameGenerationOptions } from "../../types";
import { Algorithm, Profile, Type } from "../data";
import { GeneratorMetadata } from "../generator-metadata";

const effWordList: GeneratorMetadata<EffUsernameGenerationOptions> = deepFreeze({
  id: Algorithm.username,
  type: Type.username,
  weight: 400,
  i18nKeys: {
    name: "randomWord",
    credentialType: "username",
    generateCredential: "generateUsername",
    credentialGenerated: "usernameGenerated",
    copyCredential: "copyUsername",
    useCredential: "useThisUsername",
  },
  capabilities: {
    autogenerate: true,
    fields: [],
  },
  engine: {
    create(
      dependencies: GeneratorDependencyProvider,
    ): CredentialGenerator<EffUsernameGenerationOptions> {
      return new UsernameRandomizer(dependencies.randomizer);
    },
  },
  profiles: {
    [Profile.account]: {
      type: "core",
      storage: {
        key: "effUsernameGeneratorSettings",
        target: "object",
        format: "plain",
        classifier: new PublicClassifier<EffUsernameGenerationOptions>([
          "wordCapitalize",
          "wordIncludeNumber",
        ]),
        state: GENERATOR_DISK,
        initial: {
          wordCapitalize: false,
          wordIncludeNumber: false,
          website: null,
        },
        options: {
          deserializer: (value) => value,
          clearOn: ["logout"],
        },
      },
      constraints: {
        default: {},
        create(_policies, _context) {
          return new IdentityConstraint<EffUsernameGenerationOptions>();
        },
      },
    },
  },
});

export default effWordList;
