import { GENERATOR_DISK } from "@bitwarden/common/platform/state";
import { PublicClassifier } from "@bitwarden/common/tools/public-classifier";
import { deepFreeze } from "@bitwarden/common/tools/util";

import { EmailRandomizer } from "../../engine";
import { CatchallConstraints } from "../../policies/catchall-constraints";
import { GeneratorDependencyProvider } from "../../providers";
import { CatchallGenerationOptions, CredentialGenerator } from "../../types";
import { Algorithm, Type, Profile } from "../data";
import { GeneratorMetadata } from "../generator-metadata";

const catchall: GeneratorMetadata<CatchallGenerationOptions> = deepFreeze({
  id: Algorithm.catchall,
  type: Type.email,
  weight: 210,
  i18nKeys: {
    name: "catchallEmail",
    description: "catchallEmailDesc",
    credentialType: "email",
    generateCredential: "generateEmail",
    credentialGenerated: "emailGenerated",
    copyCredential: "copyEmail",
    useCredential: "useThisEmail",
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
          return new CatchallConstraints(context.email ?? "");
        },
      },
    },
  },
});

export default catchall;
