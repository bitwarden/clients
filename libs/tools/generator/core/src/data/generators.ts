// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { GENERATOR_DISK } from "@bitwarden/common/platform/state";
import { ApiSettings } from "@bitwarden/common/tools/integration/rpc";
import { PublicClassifier } from "@bitwarden/common/tools/public-classifier";
import { IdentityConstraint } from "@bitwarden/common/tools/state/identity-state-constraint";
import { ObjectKey } from "@bitwarden/common/tools/state/object-key";

import {
  EmailRandomizer,
  ForwarderConfiguration,
  PasswordRandomizer,
  UsernameRandomizer,
} from "../engine";
import { Forwarder } from "../engine/forwarder";
import {
  DefaultPolicyEvaluator,
  DynamicPasswordPolicyConstraints,
  PassphraseGeneratorOptionsEvaluator,
  passphraseLeastPrivilege,
  PassphrasePolicyConstraints,
  PasswordGeneratorOptionsEvaluator,
  passwordLeastPrivilege,
} from "../policies";
import { CatchallConstraints } from "../policies/catchall-constraints";
import { SubaddressConstraints } from "../policies/subaddress-constraints";
import {
  CatchallGenerationOptions,
  CredentialGenerator,
  CredentialGeneratorConfiguration,
  EffUsernameGenerationOptions,
  GeneratorDependencyProvider,
  NoPolicy,
  PassphraseGenerationOptions,
  PassphraseGeneratorPolicy,
  PasswordGenerationOptions,
  PasswordGeneratorPolicy,
  SubaddressGenerationOptions,
} from "../types";

import { DefaultCatchallOptions } from "./default-catchall-options";
import { DefaultEffUsernameOptions } from "./default-eff-username-options";
import { DefaultPassphraseBoundaries } from "./default-passphrase-boundaries";
import { DefaultPassphraseGenerationOptions } from "./default-passphrase-generation-options";
import { DefaultPasswordBoundaries } from "./default-password-boundaries";
import { DefaultPasswordGenerationOptions } from "./default-password-generation-options";
import { DefaultSubaddressOptions } from "./default-subaddress-generator-options";

const PASSPHRASE: CredentialGeneratorConfiguration<
  PassphraseGenerationOptions,
  PassphraseGeneratorPolicy
> = Object.freeze({
  id: "passphrase",
  category: "password",
  nameKey: "passphrase",
  generateKey: "generatePassphrase",
  onGeneratedMessageKey: "passphraseGenerated",
  credentialTypeKey: "passphrase",
  copyKey: "copyPassphrase",
  useGeneratedValueKey: "useThisPassword",
  onlyOnRequest: false,
  request: [],
  engine: {
    create(
      dependencies: GeneratorDependencyProvider,
    ): CredentialGenerator<PassphraseGenerationOptions> {
      return new PasswordRandomizer(dependencies.randomizer);
    },
  },
  settings: {
    initial: DefaultPassphraseGenerationOptions,
    constraints: {
      numWords: {
        min: DefaultPassphraseBoundaries.numWords.min,
        max: DefaultPassphraseBoundaries.numWords.max,
        recommendation: DefaultPassphraseGenerationOptions.numWords,
      },
      wordSeparator: { maxLength: 1 },
    },
    account: {
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
      initial: DefaultPassphraseGenerationOptions,
      options: {
        deserializer: (value) => value,
        clearOn: ["logout"],
      },
    } satisfies ObjectKey<PassphraseGenerationOptions>,
  },
  policy: {
    type: PolicyType.PasswordGenerator,
    disabledValue: Object.freeze({
      minNumberWords: 0,
      capitalize: false,
      includeNumber: false,
    }),
    combine: passphraseLeastPrivilege,
    createEvaluator: (policy) => new PassphraseGeneratorOptionsEvaluator(policy),
    toConstraints: (policy) =>
      new PassphrasePolicyConstraints(policy, PASSPHRASE.settings.constraints),
  },
});

const PASSWORD: CredentialGeneratorConfiguration<
  PasswordGenerationOptions,
  PasswordGeneratorPolicy
> = Object.freeze({
  id: "password",
  category: "password",
  nameKey: "password",
  generateKey: "generatePassword",
  onGeneratedMessageKey: "passwordGenerated",
  credentialTypeKey: "password",
  copyKey: "copyPassword",
  useGeneratedValueKey: "useThisPassword",
  onlyOnRequest: false,
  request: [],
  engine: {
    create(
      dependencies: GeneratorDependencyProvider,
    ): CredentialGenerator<PasswordGenerationOptions> {
      return new PasswordRandomizer(dependencies.randomizer);
    },
  },
  settings: {
    initial: DefaultPasswordGenerationOptions,
    constraints: {
      length: {
        min: DefaultPasswordBoundaries.length.min,
        max: DefaultPasswordBoundaries.length.max,
        recommendation: DefaultPasswordGenerationOptions.length,
      },
      minNumber: {
        min: DefaultPasswordBoundaries.minDigits.min,
        max: DefaultPasswordBoundaries.minDigits.max,
      },
      minSpecial: {
        min: DefaultPasswordBoundaries.minSpecialCharacters.min,
        max: DefaultPasswordBoundaries.minSpecialCharacters.max,
      },
    },
    account: {
      key: "passwordGeneratorSettings",
      target: "object",
      format: "plain",
      classifier: new PublicClassifier<PasswordGenerationOptions>([
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
      initial: DefaultPasswordGenerationOptions,
      options: {
        deserializer: (value) => value,
        clearOn: ["logout"],
      },
    } satisfies ObjectKey<PasswordGenerationOptions>,
  },
  policy: {
    type: PolicyType.PasswordGenerator,
    disabledValue: Object.freeze({
      minLength: 0,
      useUppercase: false,
      useLowercase: false,
      useNumbers: false,
      numberCount: 0,
      useSpecial: false,
      specialCount: 0,
    }),
    combine: passwordLeastPrivilege,
    createEvaluator: (policy) => new PasswordGeneratorOptionsEvaluator(policy),
    toConstraints: (policy) =>
      new DynamicPasswordPolicyConstraints(policy, PASSWORD.settings.constraints),
  },
});

const USERNAME: CredentialGeneratorConfiguration<EffUsernameGenerationOptions, NoPolicy> =
  Object.freeze({
    id: "username",
    category: "username",
    nameKey: "randomWord",
    generateKey: "generateUsername",
    onGeneratedMessageKey: "usernameGenerated",
    credentialTypeKey: "username",
    copyKey: "copyUsername",
    useGeneratedValueKey: "useThisUsername",
    onlyOnRequest: false,
    request: [],
    engine: {
      create(
        dependencies: GeneratorDependencyProvider,
      ): CredentialGenerator<EffUsernameGenerationOptions> {
        return new UsernameRandomizer(dependencies.randomizer);
      },
    },
    settings: {
      initial: DefaultEffUsernameOptions,
      constraints: {},
      account: {
        key: "effUsernameGeneratorSettings",
        target: "object",
        format: "plain",
        classifier: new PublicClassifier<EffUsernameGenerationOptions>([
          "wordCapitalize",
          "wordIncludeNumber",
        ]),
        state: GENERATOR_DISK,
        initial: DefaultEffUsernameOptions,
        options: {
          deserializer: (value) => value,
          clearOn: ["logout"],
        },
      } satisfies ObjectKey<EffUsernameGenerationOptions>,
    },
    policy: {
      type: PolicyType.PasswordGenerator,
      disabledValue: {},
      combine(_acc: NoPolicy, _policy: Policy) {
        return {};
      },
      createEvaluator(_policy: NoPolicy) {
        return new DefaultPolicyEvaluator<EffUsernameGenerationOptions>();
      },
      toConstraints(_policy: NoPolicy) {
        return new IdentityConstraint<EffUsernameGenerationOptions>();
      },
    },
  });

const CATCHALL: CredentialGeneratorConfiguration<CatchallGenerationOptions, NoPolicy> =
  Object.freeze({
    id: "catchall",
    category: "email",
    nameKey: "catchallEmail",
    descriptionKey: "catchallEmailDesc",
    generateKey: "generateEmail",
    onGeneratedMessageKey: "emailGenerated",
    credentialTypeKey: "email",
    copyKey: "copyEmail",
    useGeneratedValueKey: "useThisEmail",
    onlyOnRequest: false,
    request: [],
    engine: {
      create(
        dependencies: GeneratorDependencyProvider,
      ): CredentialGenerator<CatchallGenerationOptions> {
        return new EmailRandomizer(dependencies.randomizer);
      },
    },
    settings: {
      initial: DefaultCatchallOptions,
      constraints: { catchallDomain: { minLength: 1 } },
      account: {
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
      } satisfies ObjectKey<CatchallGenerationOptions>,
    },
    policy: {
      type: PolicyType.PasswordGenerator,
      disabledValue: {},
      combine(_acc: NoPolicy, _policy: Policy) {
        return {};
      },
      createEvaluator(_policy: NoPolicy) {
        return new DefaultPolicyEvaluator<CatchallGenerationOptions>();
      },
      toConstraints(_policy: NoPolicy, email: string) {
        return new CatchallConstraints(email);
      },
    },
  });

const SUBADDRESS: CredentialGeneratorConfiguration<SubaddressGenerationOptions, NoPolicy> =
  Object.freeze({
    id: "subaddress",
    category: "email",
    nameKey: "plusAddressedEmail",
    descriptionKey: "plusAddressedEmailDesc",
    generateKey: "generateEmail",
    onGeneratedMessageKey: "emailGenerated",
    credentialTypeKey: "email",
    copyKey: "copyEmail",
    useGeneratedValueKey: "useThisEmail",
    onlyOnRequest: false,
    request: [],
    engine: {
      create(
        dependencies: GeneratorDependencyProvider,
      ): CredentialGenerator<SubaddressGenerationOptions> {
        return new EmailRandomizer(dependencies.randomizer);
      },
    },
    settings: {
      initial: DefaultSubaddressOptions,
      constraints: {},
      account: {
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
          deserializer: (value) => value,
          clearOn: ["logout"],
        },
      } satisfies ObjectKey<SubaddressGenerationOptions>,
    },
    policy: {
      type: PolicyType.PasswordGenerator,
      disabledValue: {},
      combine(_acc: NoPolicy, _policy: Policy) {
        return {};
      },
      createEvaluator(_policy: NoPolicy) {
        return new DefaultPolicyEvaluator<SubaddressGenerationOptions>();
      },
      toConstraints(_policy: NoPolicy, email: string) {
        return new SubaddressConstraints(email);
      },
    },
  });

export function toCredentialGeneratorConfiguration<Settings extends ApiSettings = ApiSettings>(
  configuration: ForwarderConfiguration<Settings>,
) {
  const forwarder = Object.freeze({
    id: { forwarder: configuration.id },
    category: "email",
    nameKey: configuration.name,
    descriptionKey: "forwardedEmailDesc",
    generateKey: "generateEmail",
    onGeneratedMessageKey: "emailGenerated",
    credentialTypeKey: "email",
    copyKey: "copyEmail",
    useGeneratedValueKey: "useThisEmail",
    onlyOnRequest: true,
    request: configuration.forwarder.request,
    engine: {
      create(dependencies: GeneratorDependencyProvider) {
        // FIXME: figure out why `configuration` fails to typecheck
        const config: any = configuration;
        return new Forwarder(config, dependencies.client, dependencies.i18nService);
      },
    },
    settings: {
      initial: configuration.forwarder.defaultSettings,
      constraints: configuration.forwarder.settingsConstraints,
      account: configuration.forwarder.local.settings,
    },
    policy: {
      type: PolicyType.PasswordGenerator,
      disabledValue: {},
      combine(_acc: NoPolicy, _policy: Policy) {
        return {};
      },
      createEvaluator(_policy: NoPolicy) {
        return new DefaultPolicyEvaluator<Settings>();
      },
      toConstraints(_policy: NoPolicy) {
        return new IdentityConstraint<Settings>();
      },
    },
  } satisfies CredentialGeneratorConfiguration<Settings, NoPolicy>);

  return forwarder;
}

/** Generator configurations */
export const Generators = Object.freeze({
  /** Passphrase generator configuration */
  passphrase: PASSPHRASE,

  /** Password generator configuration */
  password: PASSWORD,

  /** Username generator configuration */
  username: USERNAME,

  /** Catchall email generator configuration */
  catchall: CATCHALL,

  /** Email subaddress generator configuration */
  subaddress: SUBADDRESS,
});
