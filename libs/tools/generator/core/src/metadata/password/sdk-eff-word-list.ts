import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { GENERATOR_DISK } from "@bitwarden/common/platform/state";
import { PublicClassifier } from "@bitwarden/common/tools/public-classifier";
import { ObjectKey } from "@bitwarden/common/tools/state/object-key";
import { BitwardenClient } from "@bitwarden/sdk-internal";

import { SdkPasswordRandomizer } from "../../engine";
import { passphraseLeastPrivilege, PassphrasePolicyConstraints } from "../../policies";
import { GeneratorDependencyProvider } from "../../providers";
import { CredentialGenerator, PassphraseGenerationOptions } from "../../types";
import { Algorithm, Profile, Type } from "../data";
import { GeneratorMetadata } from "../generator-metadata";

const sdkPassphrase: GeneratorMetadata<PassphraseGenerationOptions> = {
  id: Algorithm.sdkPassphrase,
  type: Type.password,
  weight: 130,
  i18nKeys: {
    name: "passphrase",
    credentialType: "passphrase",
    generateCredential: "generatePassphrase",
    credentialGenerated: "passphraseGenerated",
    copyCredential: "copyPassphrase",
    useCredential: "useThisPassphrase",
  },
  capabilities: {
    autogenerate: false,
    fields: [],
  },
  engine: {
    create(
      dependencies: GeneratorDependencyProvider,
    ): CredentialGenerator<PassphraseGenerationOptions> {
      return new SdkPasswordRandomizer(new BitwardenClient(null), Date.now); // @TODO hook up a real SDK client
    },
  },
  profiles: {
    [Profile.account]: {
      type: "core",
      storage: {
        key: "passphraseGeneratorSettings",
        target: "object",
        format: "plain",
        classifier: new PublicClassifier<PassphraseGenerationOptions>([
          "numWords",
          "wordSeparator",
          "capitalize",
          "includeNumber",
        ]),
        state: GENERATOR_DISK,
        initial: {
          numWords: 6,
          wordSeparator: "-",
          capitalize: false,
          includeNumber: false,
        },
        options: {
          deserializer(value) {
            return value;
          },
          clearOn: ["logout"],
        },
      } satisfies ObjectKey<PassphraseGenerationOptions>,
      constraints: {
        type: PolicyType.PasswordGenerator,
        default: {
          wordSeparator: { maxLength: 1 },
          numWords: {
            min: 3,
            max: 20,
            recommendation: 6,
          },
        },
        create(policies, context) {
          const initial = {
            minNumberWords: 0,
            capitalize: false,
            includeNumber: false,
          };
          const policy = policies.reduce(passphraseLeastPrivilege, initial);
          const constraints = new PassphrasePolicyConstraints(policy, context.defaultConstraints);
          return constraints;
        },
      },
    },
  },
};

export default sdkPassphrase;
