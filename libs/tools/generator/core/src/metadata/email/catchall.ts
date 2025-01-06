import { GENERATOR_DISK } from "@bitwarden/common/platform/state";
import { PublicClassifier } from "@bitwarden/common/tools/public-classifier";

import { EmailRandomizer } from "../../engine";
import { CatchallConstraints } from "../../policies/catchall-constraints";
import {
  CatchallGenerationOptions,
  CredentialGenerator,
  GeneratorDependencyProvider,
} from "../../types";
import { deepFreeze } from "../../util";
import { Algorithm, Type, Profile } from "../data";
import { GeneratorMetadata } from "../generator-metadata";

const catchall: GeneratorMetadata<CatchallGenerationOptions> = deepFreeze({
  id: Algorithm.catchall,
  category: Type.email,
  i18nKeys: {
    name: "catchallEmail",
    description: "catchallEmailDesc",
    generateCredential: "generateEmail",
    credentialGenerated: "email",
    copyCredential: "copyEmail",
  },
  capabilities: {
    autogenerate: true,
    fields: [],
  },
  engine: {
    create(
      dependencies: GeneratorDependencyProvider,
    ): CredentialGenerator<CatchallGenerationOptions> {
      return new EmailRandomizer(dependencies.randomizer);
    },
  },
  profiles: {
    [Profile.account]: {
      type: "core",
      storage: {
        key: "catchallGeneratorSettings",
        target: "object",
        format: "plain",
        classifier: new PublicClassifier<CatchallGenerationOptions>([
          "catchallType",
          "catchallDomain",
        ]),
        state: GENERATOR_DISK,
        initial: {
          catchallType: "random",
          catchallDomain: "",
        },
        options: {
          deserializer: (value) => value,
          clearOn: ["logout"],
        },
      },
      constraints: {
        default: { catchallDomain: { minLength: 1 } },
        create(_policies, context) {
          return new CatchallConstraints(context.email);
        },
      },
    },
  },
});

export default catchall;
