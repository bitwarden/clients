import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { GENERATOR_DISK } from "@bitwarden/common/platform/state";
import { PublicClassifier } from "@bitwarden/common/tools/public-classifier";
import { deepFreeze } from "@bitwarden/common/tools/util";

import { PasswordRandomizer, SdkPasswordRandomizer } from "../../engine";
import { DynamicPasswordPolicyConstraints, passwordLeastPrivilege } from "../../policies";
import { GeneratorDependencyProvider } from "../../providers";
import { CredentialGenerator, PasswordGeneratorSettings } from "../../types";
import { Algorithm, Profile, Type } from "../data";
import { GeneratorMetadata } from "../generator-metadata";

const password: GeneratorMetadata<PasswordGeneratorSettings> = deepFreeze({
  id: Algorithm.password,
  type: Type.password,
  weight: 100,
  i18nKeys: {
    name: "password",
    generateCredential: "generatePassword",
    credentialGenerated: "passwordGenerated",
    credentialType: "password",
    copyCredential: "copyPassword",
    useCredential: "useThisPassword",
  },
  capabilities: {
    autogenerate: true,
    fields: [],
  },
  engine: {
    create(
      dependencies: GeneratorDependencyProvider,
    ): CredentialGenerator<PasswordGeneratorSettings> {
      if (dependencies.sdk == undefined) {
        return new PasswordRandomizer(dependencies.randomizer, dependencies.now);
      }
      return new SdkPasswordRandomizer(dependencies.sdk, dependencies.now);
    },
  },
  profiles: {
    [Profile.account]: {
      type: "core",
      storage: {
        key: "passwordGeneratorSettings",
        target: "object",
        format: "plain",
        classifier: new PublicClassifier<PasswordGeneratorSettings>([
          "length",
          "ambiguous",
          "uppercase",
          "minUppercase",
          "lowercase",
          "minLowercase",
          "number",
          "minNumber",
          "special",
          "minSpecial",
        ]),
        state: GENERATOR_DISK,
        initial: {
          length: 14,
          ambiguous: true,
          uppercase: true,
          minUppercase: 1,
          lowercase: true,
          minLowercase: 1,
          number: true,
          minNumber: 1,
          special: false,
          minSpecial: 0,
        },
        options: {
          deserializer(value) {
            return value;
          },
          clearOn: ["logout"],
        },
      },
      constraints: {
        type: PolicyType.PasswordGenerator,
        default: {
          length: {
            min: 5,
            max: 128,
            recommendation: 14,
          },
          minNumber: {
            min: 0,
            max: 9,
          },
          minSpecial: {
            min: 0,
            max: 9,
          },
        },
        create(policies, context) {
          const initial = {
            minLength: 0,
            useUppercase: false,
            useLowercase: false,
            useNumbers: false,
            numberCount: 0,
            useSpecial: false,
            specialCount: 0,
          };
          const policy = policies.reduce(passwordLeastPrivilege, initial);
          const constraints = new DynamicPasswordPolicyConstraints(
            policy,
            context.defaultConstraints,
          );
          return constraints;
        },
      },
    },
  },
});

export default password;
