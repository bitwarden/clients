import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { IdentityConstraint } from "@bitwarden/common/tools/state/identity-state-constraint";

import { SshKeyNativeGenerator } from "../abstractions/sshkey-native-generator.abstraction";
import { EmailRandomizer, PasswordRandomizer, UsernameRandomizer } from "../engine";
import { Randomizer } from "../engine/abstractions";
import { SshKeyGenerator } from "../engine/sshkey-generator";
import {
  DefaultPolicyEvaluator,
  DynamicPasswordPolicyConstraints,
  PassphraseGeneratorOptionsEvaluator,
  passphraseLeastPrivilege,
  PassphrasePolicyConstraints,
  PasswordGeneratorOptionsEvaluator,
  passwordLeastPrivilege,
} from "../policies";
import {
  CATCHALL_SETTINGS,
  ED25519_SSHKEY_SETTINGS,
  EFF_USERNAME_SETTINGS,
  PASSPHRASE_SETTINGS,
  PASSWORD_SETTINGS,
  RSA_SSHKEY_SETTINGS,
  SUBADDRESS_SETTINGS,
} from "../strategies/storage";
import {
  CatchallGenerationOptions,
  CredentialGenerator,
  EffUsernameGenerationOptions,
  NoPolicy,
  PassphraseGenerationOptions,
  PassphraseGeneratorPolicy,
  PasswordGenerationOptions,
  PasswordGeneratorPolicy,
  SubaddressGenerationOptions,
} from "../types";
import { CredentialGeneratorConfiguration } from "../types/credential-generator-configuration";
import {
  Ed25519KeyGenrationOptions,
  RsaSshKeyGenerationOptions,
} from "../types/sshkey-generation-options";

import { DefaultCatchallOptions } from "./default-catchall-options";
import { DefaultEffUsernameOptions } from "./default-eff-username-options";
import { DefaultPassphraseBoundaries } from "./default-passphrase-boundaries";
import { DefaultPassphraseGenerationOptions } from "./default-passphrase-generation-options";
import { DefaultPasswordBoundaries } from "./default-password-boundaries";
import { DefaultPasswordGenerationOptions } from "./default-password-generation-options";
import {
  DefaultEd25519SshKeyGenerationOptions,
  DefaultRsaSshKeyGenerationOptions,
} from "./default-sshkey-generation-options";
import { DefaultSubaddressOptions } from "./default-subaddress-generator-options";

const PASSPHRASE = Object.freeze({
  id: "passphrase",
  category: "password",
  nameKey: "passphrase",
  onlyOnRequest: false,
  engine: {
    create(
      randomizer: Randomizer,
      _sshGenerator: SshKeyNativeGenerator,
    ): CredentialGenerator<PassphraseGenerationOptions> {
      return new PasswordRandomizer(randomizer);
    },
  },
  settings: {
    initial: DefaultPassphraseGenerationOptions,
    constraints: {
      numWords: {
        min: DefaultPassphraseBoundaries.numWords.min,
        max: DefaultPassphraseBoundaries.numWords.max,
      },
      wordSeparator: { maxLength: 1 },
    },
    account: PASSPHRASE_SETTINGS,
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
    toConstraints: (policy) => new PassphrasePolicyConstraints(policy),
  },
} satisfies CredentialGeneratorConfiguration<
  PassphraseGenerationOptions,
  PassphraseGeneratorPolicy
>);

const PASSWORD = Object.freeze({
  id: "password",
  category: "password",
  nameKey: "password",
  onlyOnRequest: false,
  engine: {
    create(
      randomizer: Randomizer,
      _sshGenerator: SshKeyNativeGenerator,
    ): CredentialGenerator<PasswordGenerationOptions> {
      return new PasswordRandomizer(randomizer);
    },
  },
  settings: {
    initial: DefaultPasswordGenerationOptions,
    constraints: {
      length: {
        min: DefaultPasswordBoundaries.length.min,
        max: DefaultPasswordBoundaries.length.max,
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
    account: PASSWORD_SETTINGS,
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
    toConstraints: (policy) => new DynamicPasswordPolicyConstraints(policy),
  },
} satisfies CredentialGeneratorConfiguration<PasswordGenerationOptions, PasswordGeneratorPolicy>);

const USERNAME = Object.freeze({
  id: "username",
  category: "username",
  nameKey: "randomWord",
  onlyOnRequest: false,
  engine: {
    create(randomizer: Randomizer): CredentialGenerator<EffUsernameGenerationOptions> {
      return new UsernameRandomizer(randomizer);
    },
  },
  settings: {
    initial: DefaultEffUsernameOptions,
    constraints: {},
    account: EFF_USERNAME_SETTINGS,
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
} satisfies CredentialGeneratorConfiguration<EffUsernameGenerationOptions, NoPolicy>);

const SSH_ED25519 = Object.freeze({
  id: "ed25519",
  category: "sshKey",
  nameKey: "ed25519",
  onlyOnRequest: false,
  engine: {
    create(
      _randomizer: Randomizer,
      sshGenerator: SshKeyNativeGenerator,
    ): CredentialGenerator<Ed25519KeyGenrationOptions> {
      return new SshKeyGenerator(sshGenerator);
    },
  },
  settings: {
    initial: DefaultEd25519SshKeyGenerationOptions,
    constraints: {},
    account: ED25519_SSHKEY_SETTINGS,
  },
  policy: {
    type: PolicyType.PasswordGenerator,
    disabledValue: {},
    combine(_acc: NoPolicy, _policy: Policy) {
      return {};
    },
    createEvaluator(_policy: NoPolicy) {
      return new DefaultPolicyEvaluator<Ed25519KeyGenrationOptions>();
    },
    toConstraints(_policy: NoPolicy) {
      return new IdentityConstraint<Ed25519KeyGenrationOptions>();
    },
  },
} satisfies CredentialGeneratorConfiguration<Ed25519KeyGenrationOptions, NoPolicy>);

const SSH_RSA = Object.freeze({
  id: "rsa",
  category: "sshKey",
  nameKey: "rsa",
  onlyOnRequest: false,
  engine: {
    create(
      _randomizer: Randomizer,
      sshGenerator: SshKeyNativeGenerator,
    ): CredentialGenerator<RsaSshKeyGenerationOptions> {
      return new SshKeyGenerator(sshGenerator);
    },
  },
  settings: {
    initial: DefaultRsaSshKeyGenerationOptions,
    constraints: {},
    account: RSA_SSHKEY_SETTINGS,
  },
  policy: {
    type: PolicyType.PasswordGenerator,
    disabledValue: {},
    combine(_acc: NoPolicy, _policy: Policy) {
      return {};
    },
    createEvaluator(_policy: NoPolicy) {
      return new DefaultPolicyEvaluator<RsaSshKeyGenerationOptions>();
    },
    toConstraints(_policy: NoPolicy) {
      return new IdentityConstraint<RsaSshKeyGenerationOptions>();
    },
  },
} satisfies CredentialGeneratorConfiguration<RsaSshKeyGenerationOptions, NoPolicy>);

const CATCHALL = Object.freeze({
  id: "catchall",
  category: "email",
  nameKey: "catchallEmail",
  descriptionKey: "catchallEmailDesc",
  onlyOnRequest: false,
  engine: {
    create(randomizer: Randomizer): CredentialGenerator<CatchallGenerationOptions> {
      return new EmailRandomizer(randomizer);
    },
  },
  settings: {
    initial: DefaultCatchallOptions,
    constraints: { catchallDomain: { minLength: 1 } },
    account: CATCHALL_SETTINGS,
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
    toConstraints(_policy: NoPolicy) {
      return new IdentityConstraint<CatchallGenerationOptions>();
    },
  },
} satisfies CredentialGeneratorConfiguration<CatchallGenerationOptions, NoPolicy>);

const SUBADDRESS = Object.freeze({
  id: "subaddress",
  category: "email",
  nameKey: "plusAddressedEmail",
  descriptionKey: "plusAddressedEmailDesc",
  onlyOnRequest: false,
  engine: {
    create(randomizer: Randomizer): CredentialGenerator<SubaddressGenerationOptions> {
      return new EmailRandomizer(randomizer);
    },
  },
  settings: {
    initial: DefaultSubaddressOptions,
    constraints: {},
    account: SUBADDRESS_SETTINGS,
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
    toConstraints(_policy: NoPolicy) {
      return new IdentityConstraint<SubaddressGenerationOptions>();
    },
  },
} satisfies CredentialGeneratorConfiguration<SubaddressGenerationOptions, NoPolicy>);

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

  /** Ssh rsa key generator configuration */
  rsa: SSH_RSA,

  /** Ssh ed25519 key generator configuration */
  ed25519: SSH_ED25519,
});
