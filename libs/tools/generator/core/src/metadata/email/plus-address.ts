import { GENERATOR_DISK } from "@bitwarden/common/platform/state";
import { PublicClassifier } from "@bitwarden/common/tools/public-classifier";

import { EmailRandomizer } from "../../engine";
import { SubaddressConstraints } from "../../policies/subaddress-constraints";
import {
  CredentialGenerator,
  GeneratorDependencyProvider,
  SubaddressGenerationOptions,
} from "../../types";
import { deepFreeze } from "../../util";
import { Algorithm, Profile, Type } from "../data";
import { GeneratorMetadata } from "../generator-metadata";

const plusAddress: GeneratorMetadata<SubaddressGenerationOptions> = deepFreeze({
  id: Algorithm.plusAddress,
  category: Type.email,
  i18nKeys: {
    name: "plusAddressedEmail",
    description: "plusAddressedEmailDesc",
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
    ): CredentialGenerator<SubaddressGenerationOptions> {
      return new EmailRandomizer(dependencies.randomizer);
    },
  },
  profiles: {
    [Profile.account]: {
      type: "core",
      storage: {
        key: "subaddressGeneratorSettings",
        target: "object",
        format: "plain",
        classifier: new PublicClassifier<SubaddressGenerationOptions>([
          "subaddressType",
          "subaddressEmail",
        ]),
        state: GENERATOR_DISK,
        initial: {
          subaddressType: "random",
          subaddressEmail: "",
        },
        options: {
          deserializer(value) {
            return value;
          },
          clearOn: ["logout"],
        },
      },
      constraints: {
        default: {},
        create(_policy, context) {
          return new SubaddressConstraints(context.email);
        },
      },
    },
  },
});

export default plusAddress;
