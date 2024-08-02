import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { IntegrationId } from "@bitwarden/common/tools/integration";
import { UserId } from "@bitwarden/common/types/guid";
import {
  GeneratorService,
  DefaultPassphraseGenerationOptions,
  DefaultPasswordGenerationOptions,
  DisabledPassphraseGeneratorPolicy,
  DisabledPasswordGeneratorPolicy,
  PassphraseGenerationOptions,
  PassphraseGeneratorPolicy,
  PasswordGenerationOptions,
  PasswordGeneratorPolicy,
  policies,
} from "@bitwarden/generator-core";
import {
  GeneratedCredential,
  GeneratorHistoryService,
  GeneratedPasswordHistory,
} from "@bitwarden/generator-history";
import {
  GeneratorNavigationService,
  DefaultGeneratorNavigation,
  GeneratorNavigation,
  GeneratorNavigationEvaluator,
  GeneratorNavigationPolicy,
} from "@bitwarden/generator-navigation";

import { mockAccountServiceWith } from "../../../../../common/spec";

import { LegacyPasswordGenerationService } from "./legacy-password-generation.service";
import { PasswordGeneratorOptions } from "./password-generator-options";

const SomeUser = "some user" as UserId;
const PassphraseGeneratorOptionsEvaluator = policies.PassphraseGeneratorOptionsEvaluator;
const PasswordGeneratorOptionsEvaluator = policies.PasswordGeneratorOptionsEvaluator;

function createPassphraseGenerator(
  options: PassphraseGenerationOptions = {},
  policy: PassphraseGeneratorPolicy = DisabledPassphraseGeneratorPolicy,
) {
  let savedOptions = options;
  const generator = mock<GeneratorService<PassphraseGenerationOptions, PassphraseGeneratorPolicy>>({
    evaluator$(id: UserId) {
      const evaluator = new PassphraseGeneratorOptionsEvaluator(policy);
      return of(evaluator);
    },
    options$(id: UserId) {
      return of(savedOptions);
    },
    defaults$(id: UserId) {
      return of(DefaultPassphraseGenerationOptions);
    },
    saveOptions(userId, options) {
      savedOptions = options;
      return Promise.resolve();
    },
  });

  return generator;
}

function createPasswordGenerator(
  options: PasswordGenerationOptions = {},
  policy: PasswordGeneratorPolicy = DisabledPasswordGeneratorPolicy,
) {
  let savedOptions = options;
  const generator = mock<GeneratorService<PasswordGenerationOptions, PasswordGeneratorPolicy>>({
    evaluator$(id: UserId) {
      const evaluator = new PasswordGeneratorOptionsEvaluator(policy);
      return of(evaluator);
    },
    options$(id: UserId) {
      return of(savedOptions);
    },
    defaults$(id: UserId) {
      return of(DefaultPasswordGenerationOptions);
    },
    saveOptions(userId, options) {
      savedOptions = options;
      return Promise.resolve();
    },
  });

  return generator;
}

function createNavigationGenerator(
  options: GeneratorNavigation = {},
  policy: GeneratorNavigationPolicy = {},
) {
  let savedOptions = options;
  const generator = mock<GeneratorNavigationService>({
    evaluator$(id: UserId) {
      const evaluator = new GeneratorNavigationEvaluator(policy);
      return of(evaluator);
    },
    options$(id: UserId) {
      return of(savedOptions);
    },
    defaults$(id: UserId) {
      return of(DefaultGeneratorNavigation);
    },
    saveOptions: jest.fn((userId, options) => {
      savedOptions = options;
      return Promise.resolve();
    }),
  });

  return generator;
}

describe("LegacyPasswordGenerationService", () => {
  // NOTE: in all tests, `null` constructor arguments are not used by the test.
  // They're set to `null` to avoid setting up unnecessary mocks.

  describe("generatePassword", () => {
    it("invokes the inner password generator to generate passwords", async () => {
      const innerPassword = createPasswordGenerator();
      const generator = new LegacyPasswordGenerationService(null, null, innerPassword, null, null);
      const options = { type: "password" } as PasswordGeneratorOptions;

      await generator.generatePassword(options);

      expect(innerPassword.generate).toHaveBeenCalledWith(options);
    });

    it("invokes the inner passphrase generator to generate passphrases", async () => {
      const innerPassphrase = createPassphraseGenerator();
      const generator = new LegacyPasswordGenerationService(
        null,
        null,
        null,
        innerPassphrase,
        null,
      );
      const options = { type: "passphrase" } as PasswordGeneratorOptions;

      await generator.generatePassword(options);

      expect(innerPassphrase.generate).toHaveBeenCalledWith(options);
    });
  });

  describe("generatePassphrase", () => {
    it("invokes the inner passphrase generator", async () => {
      const innerPassphrase = createPassphraseGenerator();
      const generator = new LegacyPasswordGenerationService(
        null,
        null,
        null,
        innerPassphrase,
        null,
      );
      const options = {} as PasswordGeneratorOptions;

      await generator.generatePassphrase(options);

      expect(innerPassphrase.generate).toHaveBeenCalledWith(options);
    });
  });

  describe("getOptions", () => {
    it("combines options from its inner services", async () => {
      const innerPassword = createPasswordGenerator({
        length: 29,
        minLength: 20,
        ambiguous: false,
        uppercase: true,
        minUppercase: 1,
        lowercase: false,
        minLowercase: 2,
        number: true,
        minNumber: 3,
        special: false,
        minSpecial: 0,
      });
      const innerPassphrase = createPassphraseGenerator({
        numWords: 10,
        wordSeparator: "-",
        capitalize: true,
        includeNumber: false,
      });
      const navigation = createNavigationGenerator({
        type: "passphrase",
        username: "word",
        forwarder: "simplelogin" as IntegrationId,
      });
      const accountService = mockAccountServiceWith(SomeUser);
      const generator = new LegacyPasswordGenerationService(
        accountService,
        navigation,
        innerPassword,
        innerPassphrase,
        null,
      );

      const [result] = await generator.getOptions();

      expect(result).toEqual({
        type: "passphrase",
        length: 29,
        minLength: 5,
        ambiguous: false,
        uppercase: true,
        minUppercase: 1,
        lowercase: false,
        minLowercase: 0,
        number: true,
        minNumber: 3,
        special: false,
        minSpecial: 0,
        numWords: 10,
        wordSeparator: "-",
        capitalize: true,
        includeNumber: false,
        policyUpdated: true,
      });
    });

    it("sets default options when an inner service lacks a value", async () => {
      const innerPassword = createPasswordGenerator(null);
      const innerPassphrase = createPassphraseGenerator(null);
      const navigation = createNavigationGenerator(null);
      const accountService = mockAccountServiceWith(SomeUser);
      const generator = new LegacyPasswordGenerationService(
        accountService,
        navigation,
        innerPassword,
        innerPassphrase,
        null,
      );

      const [result] = await generator.getOptions();

      expect(result).toEqual({
        type: DefaultGeneratorNavigation.type,
        ...DefaultPassphraseGenerationOptions,
        ...DefaultPasswordGenerationOptions,
        minLowercase: 1,
        minUppercase: 1,
        policyUpdated: true,
      });
    });

    it("combines policies from its inner services", async () => {
      const innerPassword = createPasswordGenerator(
        {},
        {
          minLength: 20,
          numberCount: 10,
          specialCount: 11,
          useUppercase: true,
          useLowercase: false,
          useNumbers: true,
          useSpecial: false,
        },
      );
      const innerPassphrase = createPassphraseGenerator(
        {},
        {
          minNumberWords: 5,
          capitalize: true,
          includeNumber: false,
        },
      );
      const accountService = mockAccountServiceWith(SomeUser);
      const navigation = createNavigationGenerator(
        {},
        {
          defaultType: "password",
        },
      );
      const generator = new LegacyPasswordGenerationService(
        accountService,
        navigation,
        innerPassword,
        innerPassphrase,
        null,
      );

      const [, policy] = await generator.getOptions();

      expect(policy).toEqual({
        defaultType: "password",
        minLength: 20,
        numberCount: 10,
        specialCount: 11,
        useUppercase: true,
        useLowercase: false,
        useNumbers: true,
        useSpecial: false,
        minNumberWords: 5,
        capitalize: true,
        includeNumber: false,
      });
    });
  });

  describe("enforcePasswordGeneratorPoliciesOnOptions", () => {
    it("returns its options parameter with password policy applied", async () => {
      const innerPassword = createPasswordGenerator(
        {},
        {
          minLength: 15,
          numberCount: 5,
          specialCount: 5,
          useUppercase: true,
          useLowercase: true,
          useNumbers: true,
          useSpecial: true,
        },
      );
      const innerPassphrase = createPassphraseGenerator();
      const accountService = mockAccountServiceWith(SomeUser);
      const navigation = createNavigationGenerator();
      const options = {
        type: "password" as const,
      };
      const generator = new LegacyPasswordGenerationService(
        accountService,
        navigation,
        innerPassword,
        innerPassphrase,
        null,
      );

      const [result] = await generator.enforcePasswordGeneratorPoliciesOnOptions(options);

      expect(result).toBe(options);
      expect(result).toMatchObject({
        length: 15,
        minLength: 15,
        minLowercase: 1,
        minNumber: 5,
        minUppercase: 1,
        minSpecial: 5,
        uppercase: true,
        lowercase: true,
        number: true,
        special: true,
      });
    });

    it("returns its options parameter with passphrase policy applied", async () => {
      const innerPassword = createPasswordGenerator();
      const innerPassphrase = createPassphraseGenerator(
        {},
        {
          minNumberWords: 5,
          capitalize: true,
          includeNumber: true,
        },
      );
      const accountService = mockAccountServiceWith(SomeUser);
      const navigation = createNavigationGenerator();
      const options = {
        type: "passphrase" as const,
      };
      const generator = new LegacyPasswordGenerationService(
        accountService,
        navigation,
        innerPassword,
        innerPassphrase,
        null,
      );

      const [result] = await generator.enforcePasswordGeneratorPoliciesOnOptions(options);

      expect(result).toBe(options);
      expect(result).toMatchObject({
        numWords: 5,
        capitalize: true,
        includeNumber: true,
      });
    });

    it("returns the applied policy", async () => {
      const innerPassword = createPasswordGenerator(
        {},
        {
          minLength: 20,
          numberCount: 10,
          specialCount: 11,
          useUppercase: true,
          useLowercase: false,
          useNumbers: true,
          useSpecial: false,
        },
      );
      const innerPassphrase = createPassphraseGenerator(
        {},
        {
          minNumberWords: 5,
          capitalize: true,
          includeNumber: false,
        },
      );
      const accountService = mockAccountServiceWith(SomeUser);
      const navigation = createNavigationGenerator(
        {},
        {
          defaultType: "password",
        },
      );
      const generator = new LegacyPasswordGenerationService(
        accountService,
        navigation,
        innerPassword,
        innerPassphrase,
        null,
      );

      const [, policy] = await generator.enforcePasswordGeneratorPoliciesOnOptions({});

      expect(policy).toEqual({
        defaultType: "password",
        minLength: 20,
        numberCount: 10,
        specialCount: 11,
        useUppercase: true,
        useLowercase: false,
        useNumbers: true,
        useSpecial: false,
        minNumberWords: 5,
        capitalize: true,
        includeNumber: false,
      });
    });
  });

  describe("saveOptions", () => {
    it("loads saved password options", async () => {
      const innerPassword = createPasswordGenerator();
      const innerPassphrase = createPassphraseGenerator();
      const navigation = createNavigationGenerator();
      const accountService = mockAccountServiceWith(SomeUser);
      const generator = new LegacyPasswordGenerationService(
        accountService,
        navigation,
        innerPassword,
        innerPassphrase,
        null,
      );
      const options = {
        type: "password" as const,
        length: 29,
        minLength: 5,
        ambiguous: false,
        uppercase: true,
        minUppercase: 1,
        lowercase: false,
        minLowercase: 0,
        number: true,
        minNumber: 3,
        special: false,
        minSpecial: 0,
      };
      await generator.saveOptions(options);

      const [result] = await generator.getOptions();

      expect(result).toMatchObject(options);
    });

    it("loads saved passphrase options", async () => {
      const innerPassword = createPasswordGenerator();
      const innerPassphrase = createPassphraseGenerator();
      const navigation = createNavigationGenerator();
      const accountService = mockAccountServiceWith(SomeUser);
      const generator = new LegacyPasswordGenerationService(
        accountService,
        navigation,
        innerPassword,
        innerPassphrase,
        null,
      );
      const options = {
        type: "passphrase" as const,
        numWords: 10,
        wordSeparator: "-",
        capitalize: true,
        includeNumber: false,
      };
      await generator.saveOptions(options);

      const [result] = await generator.getOptions();

      expect(result).toMatchObject(options);
    });

    it("preserves saved navigation options", async () => {
      const innerPassword = createPasswordGenerator();
      const innerPassphrase = createPassphraseGenerator();
      const navigation = createNavigationGenerator({
        type: "password",
        username: "forwarded",
        forwarder: "firefoxrelay" as IntegrationId,
      });
      const accountService = mockAccountServiceWith(SomeUser);
      const generator = new LegacyPasswordGenerationService(
        accountService,
        navigation,
        innerPassword,
        innerPassphrase,
        null,
      );
      const options = {
        type: "passphrase" as const,
        numWords: 10,
        wordSeparator: "-",
        capitalize: true,
        includeNumber: false,
      };

      await generator.saveOptions(options);

      expect(navigation.saveOptions).toHaveBeenCalledWith(SomeUser, {
        type: "passphrase",
        username: "forwarded",
        forwarder: "firefoxrelay",
      });
    });
  });

  describe("getHistory", () => {
    it("gets the active user's history from the history service", async () => {
      const history = mock<GeneratorHistoryService>();
      history.credentials$.mockReturnValue(
        of([new GeneratedCredential("foo", "password", new Date(100))]),
      );
      const accountService = mockAccountServiceWith(SomeUser);
      const generator = new LegacyPasswordGenerationService(
        accountService,
        null,
        null,
        null,
        history,
      );

      const result = await generator.getHistory();

      expect(history.credentials$).toHaveBeenCalledWith(SomeUser);
      expect(result).toEqual([new GeneratedPasswordHistory("foo", 100)]);
    });
  });

  describe("addHistory", () => {
    it("adds a history item as a password credential", async () => {
      const history = mock<GeneratorHistoryService>();
      const accountService = mockAccountServiceWith(SomeUser);
      const generator = new LegacyPasswordGenerationService(
        accountService,
        null,
        null,
        null,
        history,
      );

      await generator.addHistory("foo");

      expect(history.track).toHaveBeenCalledWith(SomeUser, "foo", "password");
    });
  });
});
