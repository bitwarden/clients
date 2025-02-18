// FIXME: remove ts-strict-ignore once `FakeAccountService` implements ts strict support
// @ts-strict-ignore
import { mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, map, Subject } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { GENERATOR_DISK, UserKeyDefinition } from "@bitwarden/common/platform/state";
import { LegacyEncryptorProvider } from "@bitwarden/common/tools/cryptography/legacy-encryptor-provider";
import { UserEncryptor } from "@bitwarden/common/tools/cryptography/user-encryptor.abstraction";
import { disabledSemanticLoggerProvider } from "@bitwarden/common/tools/log";
import { StateConstraints } from "@bitwarden/common/tools/types";
import { OrganizationId, PolicyId, UserId } from "@bitwarden/common/types/guid";

import {
  FakeStateProvider,
  FakeAccountService,
  awaitAsync,
  ObservableTracker,
} from "../../../../../common/spec";
import { Randomizer } from "../abstractions";
import { Generators } from "../data";
import {
  CredentialGeneratorConfiguration,
  GeneratedCredential,
  GenerateRequest,
  GeneratorConstraints,
} from "../types";

import { CredentialGeneratorService } from "./credential-generator.service";

// arbitrary settings types
type SomeSettings = { foo: string };
type SomePolicy = { fooPolicy: boolean };

// settings storage location
const SettingsKey = new UserKeyDefinition<SomeSettings>(GENERATOR_DISK, "SomeSettings", {
  deserializer: (value) => value,
  clearOn: [],
});

// fake policies
const policyService = mock<PolicyService>();
const somePolicy = new Policy({
  data: { fooPolicy: true },
  type: PolicyType.PasswordGenerator,
  id: "" as PolicyId,
  organizationId: "" as OrganizationId,
  enabled: true,
});
const passwordOverridePolicy = new Policy({
  id: "" as PolicyId,
  organizationId: "",
  type: PolicyType.PasswordGenerator,
  data: {
    overridePasswordType: "password",
  },
  enabled: true,
});

const passphraseOverridePolicy = new Policy({
  id: "" as PolicyId,
  organizationId: "",
  type: PolicyType.PasswordGenerator,
  data: {
    overridePasswordType: "passphrase",
  },
  enabled: true,
});

const SomeTime = new Date(1);
const SomeAlgorithm = "passphrase";
const SomeCategory = "password";
const SomeNameKey = "passphraseKey";
const SomeGenerateKey = "generateKey";
const SomeCredentialTypeKey = "credentialTypeKey";
const SomeOnGeneratedMessageKey = "onGeneratedMessageKey";
const SomeCopyKey = "copyKey";
const SomeUseGeneratedValueKey = "useGeneratedValueKey";

// fake the configuration
const SomeConfiguration: CredentialGeneratorConfiguration<SomeSettings, SomePolicy> = {
  id: SomeAlgorithm,
  category: SomeCategory,
  nameKey: SomeNameKey,
  generateKey: SomeGenerateKey,
  onGeneratedMessageKey: SomeOnGeneratedMessageKey,
  credentialTypeKey: SomeCredentialTypeKey,
  copyKey: SomeCopyKey,
  useGeneratedValueKey: SomeUseGeneratedValueKey,
  onlyOnRequest: false,
  request: [],
  engine: {
    create: (_randomizer) => {
      return {
        generate: (request, settings) => {
          const result = new GeneratedCredential(
            settings.foo,
            SomeAlgorithm,
            SomeTime,
            request.source,
            request.website,
          );
          return Promise.resolve(result);
        },
      };
    },
  },
  settings: {
    initial: { foo: "initial" },
    constraints: { foo: {} },
    account: SettingsKey,
  },
  policy: {
    type: PolicyType.PasswordGenerator,
    disabledValue: {
      fooPolicy: false,
    },
    combine: (acc, policy) => {
      return { fooPolicy: acc.fooPolicy || policy.data.fooPolicy };
    },
    createEvaluator: () => {
      throw new Error("this should never be called");
    },
    toConstraints: (policy) => {
      if (policy.fooPolicy) {
        return {
          constraints: {
            policyInEffect: true,
          },
          calibrate(state: SomeSettings) {
            return {
              constraints: {},
              adjust(state: SomeSettings) {
                return { foo: `adjusted(${state.foo})` };
              },
              fix(state: SomeSettings) {
                return { foo: `fixed(${state.foo})` };
              },
            } satisfies StateConstraints<SomeSettings>;
          },
        } satisfies GeneratorConstraints<SomeSettings>;
      } else {
        return {
          constraints: {
            policyInEffect: false,
          },
          adjust(state: SomeSettings) {
            return state;
          },
          fix(state: SomeSettings) {
            return state;
          },
        } satisfies GeneratorConstraints<SomeSettings>;
      }
    },
  },
};

// fake user information
const SomeUser = "SomeUser" as UserId;
const AnotherUser = "SomeOtherUser" as UserId;
const accounts = {
  [SomeUser]: {
    id: SomeUser,
    name: "some user",
    email: "some.user@example.com",
    emailVerified: true,
  },
  [AnotherUser]: {
    id: AnotherUser,
    name: "some other user",
    email: "some.other.user@example.com",
    emailVerified: true,
  },
};
const accountService = new FakeAccountService(accounts);

// fake state
const stateProvider = new FakeStateProvider(accountService);

// fake randomizer
const randomizer = mock<Randomizer>();

const i18nService = mock<I18nService>();

const apiService = mock<ApiService>();

const encryptor = mock<UserEncryptor>();
const encryptorProvider = mock<LegacyEncryptorProvider>({
  userEncryptor$(_, dependencies) {
    return dependencies.singleUserId$.pipe(map((userId) => ({ userId, encryptor })));
  },
});

const account$ = new BehaviorSubject(accounts[SomeUser]);

const providers = {
  encryptor: encryptorProvider,
  state: stateProvider,
  log: disabledSemanticLoggerProvider,
};

describe("CredentialGeneratorService", () => {
  beforeEach(async () => {
    await accountService.switchAccount(SomeUser);
    policyService.getAll$.mockImplementation(() => new BehaviorSubject([]).asObservable());
    i18nService.t.mockImplementation((key: string) => key);
    apiService.fetch.mockImplementation(() => Promise.resolve(mock<Response>()));
    jest.clearAllMocks();
  });

  describe("generate$", () => {
    it("completes when `on$` completes", async () => {
      await stateProvider.setUserState(SettingsKey, { foo: "value" }, SomeUser);
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );
      const on$ = new Subject<GenerateRequest>();
      let complete = false;

      // confirm no emission during subscription
      generator.generate$(SomeConfiguration, { on$, account$ }).subscribe({
        complete: () => {
          complete = true;
        },
      });
      on$.complete();
      await awaitAsync();

      expect(complete).toBeTruthy();
    });

    it("includes request.source in the generated credential", async () => {
      const settings = { foo: "value" };
      await stateProvider.setUserState(SettingsKey, settings, SomeUser);
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );
      const on$ = new BehaviorSubject<GenerateRequest>({ source: "some source" });
      const generated = new ObservableTracker(
        generator.generate$(SomeConfiguration, { on$, account$ }),
      );

      const result = await generated.expectEmission();

      expect(result.source).toEqual("some source");
    });

    it("includes request.website in the generated credential", async () => {
      const settings = { foo: "value" };
      await stateProvider.setUserState(SettingsKey, settings, SomeUser);
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );
      const on$ = new BehaviorSubject({ website: "some website" });
      const generated = new ObservableTracker(
        generator.generate$(SomeConfiguration, { on$, account$ }),
      );

      const result = await generated.expectEmission();

      expect(result.website).toEqual("some website");
    });

    // FIXME: test these when the fake state provider can create the required emissions
    it.todo("errors when the settings error");
    it.todo("completes when the settings complete");

    it("emits a generation for a specific user when `user$` supplied", async () => {
      await stateProvider.setUserState(SettingsKey, { foo: "value" }, SomeUser);
      await stateProvider.setUserState(SettingsKey, { foo: "another" }, AnotherUser);
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );
      const account$ = new BehaviorSubject(accounts[AnotherUser]).asObservable();
      const on$ = new Subject<GenerateRequest>();
      const generated = new ObservableTracker(
        generator.generate$(SomeConfiguration, { on$, account$ }),
      );
      on$.next({});

      const result = await generated.expectEmission();

      expect(result).toEqual(new GeneratedCredential("another", SomeAlgorithm, SomeTime));
    });

    it("errors when `user$` errors", async () => {
      await stateProvider.setUserState(SettingsKey, null, SomeUser);
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );
      const on$ = new Subject<GenerateRequest>();
      const account$ = new BehaviorSubject(accounts[SomeUser]);
      let error = null;

      generator.generate$(SomeConfiguration, { on$, account$ }).subscribe({
        error: (e: unknown) => {
          error = e;
        },
      });
      account$.error({ some: "error" });
      await awaitAsync();

      expect(error).toEqual({ some: "error" });
    });

    it("completes when `user$` completes", async () => {
      await stateProvider.setUserState(SettingsKey, null, SomeUser);
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );
      const on$ = new Subject<GenerateRequest>();
      const account$ = new BehaviorSubject(accounts[SomeUser]);
      let completed = false;

      generator.generate$(SomeConfiguration, { on$, account$ }).subscribe({
        complete: () => {
          completed = true;
        },
      });
      account$.complete();
      await awaitAsync();

      expect(completed).toBeTruthy();
    });

    it("emits a generation only when `on$` emits", async () => {
      // This test breaks from arrange/act/assert because it is testing causality
      await stateProvider.setUserState(SettingsKey, { foo: "value" }, SomeUser);
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );
      const on$ = new Subject<GenerateRequest>();
      const results: any[] = [];

      // confirm no emission during subscription
      const sub = generator
        .generate$(SomeConfiguration, { on$, account$ })
        .subscribe((result) => results.push(result));
      await awaitAsync();
      expect(results.length).toEqual(0);

      // confirm forwarded emission
      on$.next({});
      await awaitAsync();
      expect(results).toEqual([new GeneratedCredential("value", SomeAlgorithm, SomeTime)]);

      // confirm updating settings does not cause an emission
      await stateProvider.setUserState(SettingsKey, { foo: "next" }, SomeUser);
      await awaitAsync();
      expect(results.length).toBe(1);

      // confirm forwarded emission takes latest value
      on$.next({});
      await awaitAsync();
      sub.unsubscribe();

      expect(results).toEqual([
        new GeneratedCredential("value", SomeAlgorithm, SomeTime),
        new GeneratedCredential("next", SomeAlgorithm, SomeTime),
      ]);
    });

    it("errors when `on$` errors", async () => {
      await stateProvider.setUserState(SettingsKey, { foo: "value" }, SomeUser);
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );
      const on$ = new Subject<GenerateRequest>();
      let error: any = null;

      // confirm no emission during subscription
      generator.generate$(SomeConfiguration, { on$, account$ }).subscribe({
        error: (e: unknown) => {
          error = e;
        },
      });
      on$.error({ some: "error" });
      await awaitAsync();

      expect(error).toEqual({ some: "error" });
    });

    // FIXME: test these when the fake state provider can delay its first emission
    it.todo("emits when settings$ become available if on$ is called before they're ready.");
  });

  describe("algorithms", () => {
    it("outputs password generation metadata", () => {
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );

      const result = generator.algorithms("password");

      expect(result.some((a) => a.id === Generators.password.id)).toBeTruthy();
      expect(result.some((a) => a.id === Generators.passphrase.id)).toBeTruthy();

      // this test shouldn't contain entries outside of the current category
      expect(result.some((a) => a.id === Generators.username.id)).toBeFalsy();
      expect(result.some((a) => a.id === Generators.catchall.id)).toBeFalsy();
    });

    it("outputs username generation metadata", () => {
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );

      const result = generator.algorithms("username");

      expect(result.some((a) => a.id === Generators.username.id)).toBeTruthy();

      // this test shouldn't contain entries outside of the current category
      expect(result.some((a) => a.id === Generators.catchall.id)).toBeFalsy();
      expect(result.some((a) => a.id === Generators.password.id)).toBeFalsy();
    });

    it("outputs email generation metadata", () => {
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );

      const result = generator.algorithms("email");

      expect(result.some((a) => a.id === Generators.catchall.id)).toBeTruthy();
      expect(result.some((a) => a.id === Generators.subaddress.id)).toBeTruthy();

      // this test shouldn't contain entries outside of the current category
      expect(result.some((a) => a.id === Generators.username.id)).toBeFalsy();
      expect(result.some((a) => a.id === Generators.password.id)).toBeFalsy();
    });

    it("combines metadata across categories", () => {
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );

      const result = generator.algorithms(["username", "email"]);

      expect(result.some((a) => a.id === Generators.username.id)).toBeTruthy();
      expect(result.some((a) => a.id === Generators.catchall.id)).toBeTruthy();
      expect(result.some((a) => a.id === Generators.subaddress.id)).toBeTruthy();

      // this test shouldn't contain entries outside of the current categories
      expect(result.some((a) => a.id === Generators.password.id)).toBeFalsy();
    });
  });

  describe("algorithms$", () => {
    // these tests cannot use the observable tracker because they return
    //  data that cannot be cloned
    it("returns password metadata", async () => {
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );

      const result = await firstValueFrom(generator.algorithms$("password", { account$ }));

      expect(result.some((a) => a.id === Generators.password.id)).toBeTruthy();
      expect(result.some((a) => a.id === Generators.passphrase.id)).toBeTruthy();
    });

    it("returns username metadata", async () => {
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );

      const result = await firstValueFrom(generator.algorithms$("username", { account$ }));

      expect(result.some((a) => a.id === Generators.username.id)).toBeTruthy();
    });

    it("returns email metadata", async () => {
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );

      const result = await firstValueFrom(generator.algorithms$("email", { account$ }));

      expect(result.some((a) => a.id === Generators.catchall.id)).toBeTruthy();
      expect(result.some((a) => a.id === Generators.subaddress.id)).toBeTruthy();
    });

    it("returns username and email metadata", async () => {
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );

      const result = await firstValueFrom(
        generator.algorithms$(["username", "email"], { account$ }),
      );

      expect(result.some((a) => a.id === Generators.username.id)).toBeTruthy();
      expect(result.some((a) => a.id === Generators.catchall.id)).toBeTruthy();
      expect(result.some((a) => a.id === Generators.subaddress.id)).toBeTruthy();
    });

    // Subsequent tests focus on passwords and passphrases as an example of policy
    // awareness; they exercise the logic without being comprehensive
    it("enforces the active user's policy", async () => {
      const policy$ = new BehaviorSubject([passwordOverridePolicy]);
      policyService.getAll$.mockReturnValue(policy$);
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );

      const result = await firstValueFrom(generator.algorithms$(["password"], { account$ }));

      expect(policyService.getAll$).toHaveBeenCalledWith(PolicyType.PasswordGenerator, SomeUser);
      expect(result.some((a) => a.id === Generators.password.id)).toBeTruthy();
      expect(result.some((a) => a.id === Generators.passphrase.id)).toBeFalsy();
    });

    it("follows changes to the active user", async () => {
      const account$ = new BehaviorSubject(accounts[SomeUser]);
      policyService.getAll$.mockReturnValueOnce(new BehaviorSubject([passwordOverridePolicy]));
      policyService.getAll$.mockReturnValueOnce(new BehaviorSubject([passphraseOverridePolicy]));
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );
      const results: any = [];
      const sub = generator.algorithms$("password", { account$ }).subscribe((r) => results.push(r));

      account$.next(accounts[AnotherUser]);
      await awaitAsync();
      sub.unsubscribe();

      const [someResult, anotherResult] = results;

      expect(policyService.getAll$).toHaveBeenNthCalledWith(
        1,
        PolicyType.PasswordGenerator,
        SomeUser,
      );
      expect(someResult.some((a: any) => a.id === Generators.password.id)).toBeTruthy();
      expect(someResult.some((a: any) => a.id === Generators.passphrase.id)).toBeFalsy();

      expect(policyService.getAll$).toHaveBeenNthCalledWith(
        2,
        PolicyType.PasswordGenerator,
        AnotherUser,
      );
      expect(anotherResult.some((a: any) => a.id === Generators.passphrase.id)).toBeTruthy();
      expect(anotherResult.some((a: any) => a.id === Generators.password.id)).toBeFalsy();
    });

    it("reads an arbitrary user's settings", async () => {
      policyService.getAll$.mockReturnValueOnce(new BehaviorSubject([passwordOverridePolicy]));
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );
      const account$ = new BehaviorSubject(accounts[AnotherUser]).asObservable();

      const result = await firstValueFrom(generator.algorithms$("password", { account$ }));

      expect(policyService.getAll$).toHaveBeenCalledWith(PolicyType.PasswordGenerator, AnotherUser);
      expect(result.some((a: any) => a.id === Generators.password.id)).toBeTruthy();
      expect(result.some((a: any) => a.id === Generators.passphrase.id)).toBeFalsy();
    });

    it("follows changes to the arbitrary user", async () => {
      policyService.getAll$.mockReturnValueOnce(new BehaviorSubject([passwordOverridePolicy]));
      policyService.getAll$.mockReturnValueOnce(new BehaviorSubject([passphraseOverridePolicy]));
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );
      const account = new BehaviorSubject(accounts[SomeUser]);
      const account$ = account.asObservable();
      const results: any = [];
      const sub = generator.algorithms$("password", { account$ }).subscribe((r) => results.push(r));

      account.next(accounts[AnotherUser]);
      await awaitAsync();
      sub.unsubscribe();

      const [someResult, anotherResult] = results;
      expect(policyService.getAll$).toHaveBeenCalledWith(PolicyType.PasswordGenerator, SomeUser);
      expect(someResult.some((a: any) => a.id === Generators.password.id)).toBeTruthy();
      expect(someResult.some((a: any) => a.id === Generators.passphrase.id)).toBeFalsy();

      expect(policyService.getAll$).toHaveBeenCalledWith(PolicyType.PasswordGenerator, AnotherUser);
      expect(anotherResult.some((a: any) => a.id === Generators.passphrase.id)).toBeTruthy();
      expect(anotherResult.some((a: any) => a.id === Generators.password.id)).toBeFalsy();
    });

    it("errors when the arbitrary user's stream errors", async () => {
      policyService.getAll$.mockReturnValueOnce(new BehaviorSubject([passwordOverridePolicy]));
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );
      const account = new BehaviorSubject(accounts[SomeUser]);
      const account$ = account.asObservable();
      let error = null;

      generator.algorithms$("password", { account$ }).subscribe({
        error: (e: unknown) => {
          error = e;
        },
      });
      account.error({ some: "error" });
      await awaitAsync();

      expect(error).toEqual({ some: "error" });
    });

    it("completes when the arbitrary user's stream completes", async () => {
      policyService.getAll$.mockReturnValueOnce(new BehaviorSubject([passwordOverridePolicy]));
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );
      const account = new BehaviorSubject(accounts[SomeUser]);
      const account$ = account.asObservable();
      let completed = false;

      generator.algorithms$("password", { account$ }).subscribe({
        complete: () => {
          completed = true;
        },
      });
      account.complete();
      await awaitAsync();

      expect(completed).toBeTruthy();
    });

    it("ignores repeated arbitrary user emissions", async () => {
      policyService.getAll$.mockReturnValueOnce(new BehaviorSubject([passwordOverridePolicy]));
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );
      const account = new BehaviorSubject(accounts[SomeUser]);
      const account$ = account.asObservable();
      let count = 0;

      const sub = generator.algorithms$("password", { account$ }).subscribe({
        next: () => {
          count++;
        },
      });
      await awaitAsync();
      account.next(accounts[SomeUser]);
      await awaitAsync();
      account.next(accounts[SomeUser]);
      await awaitAsync();
      sub.unsubscribe();

      expect(count).toEqual(1);
    });
  });

  describe("settings$", () => {
    it("defaults to the configuration's initial settings if settings aren't found", async () => {
      await stateProvider.setUserState(SettingsKey, null, SomeUser);
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );

      const result = await firstValueFrom(generator.settings$(SomeConfiguration, { account$ }));

      expect(result).toEqual(SomeConfiguration.settings.initial);
    });

    it("reads from the active user's configuration-defined storage", async () => {
      const settings = { foo: "value" };
      await stateProvider.setUserState(SettingsKey, settings, SomeUser);
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );

      const result = await firstValueFrom(generator.settings$(SomeConfiguration, { account$ }));

      expect(result).toEqual(settings);
    });

    it("applies policy to the loaded settings", async () => {
      const settings = { foo: "value" };
      await stateProvider.setUserState(SettingsKey, settings, SomeUser);
      const policy$ = new BehaviorSubject([somePolicy]);
      policyService.getAll$.mockReturnValue(policy$);
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );

      const result = await firstValueFrom(generator.settings$(SomeConfiguration, { account$ }));

      expect(result).toEqual({ foo: "adjusted(value)" });
    });

    it("reads an arbitrary user's settings", async () => {
      await stateProvider.setUserState(SettingsKey, { foo: "value" }, SomeUser);
      const anotherSettings = { foo: "another" };
      await stateProvider.setUserState(SettingsKey, anotherSettings, AnotherUser);
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );
      const account$ = new BehaviorSubject(accounts[AnotherUser]).asObservable();

      const result = await firstValueFrom(generator.settings$(SomeConfiguration, { account$ }));

      expect(result).toEqual(anotherSettings);
    });

    it("errors when the arbitrary user's stream errors", async () => {
      await stateProvider.setUserState(SettingsKey, null, SomeUser);
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );
      const account = new BehaviorSubject(accounts[SomeUser]);
      const account$ = account.asObservable();
      let error = null;

      generator.settings$(SomeConfiguration, { account$ }).subscribe({
        error: (e: unknown) => {
          error = e;
        },
      });
      account.error({ some: "error" });
      await awaitAsync();

      expect(error).toEqual({ some: "error" });
    });

    it("completes when the arbitrary user's stream completes", async () => {
      await stateProvider.setUserState(SettingsKey, null, SomeUser);
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );
      const account = new BehaviorSubject(accounts[SomeUser]);
      const account$ = account.asObservable();
      let completed = false;

      generator.settings$(SomeConfiguration, { account$ }).subscribe({
        complete: () => {
          completed = true;
        },
      });
      account.complete();
      await awaitAsync();

      expect(completed).toBeTruthy();
    });
  });

  describe("settings", () => {
    it("writes to the user's state", async () => {
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );
      const subject = generator.settings(SomeConfiguration, { account$ });

      subject.next({ foo: "next value" });
      await awaitAsync();
      const result = await firstValueFrom(stateProvider.getUserState$(SettingsKey, SomeUser));

      expect(result).toEqual({
        foo: "next value",
      });
    });
  });

  describe("policy$", () => {
    it("creates constraints without policy in effect when there is no policy", async () => {
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );
      const account$ = new BehaviorSubject(accounts[SomeUser]).asObservable();

      const result = await firstValueFrom(generator.policy$(SomeConfiguration, { account$ }));

      expect(result.constraints.policyInEffect).toBeFalsy();
    });

    it("creates constraints with policy in effect when there is a policy", async () => {
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );
      const account$ = new BehaviorSubject(accounts[SomeUser]).asObservable();
      const policy$ = new BehaviorSubject([somePolicy]);
      policyService.getAll$.mockReturnValue(policy$);

      const result = await firstValueFrom(generator.policy$(SomeConfiguration, { account$ }));

      expect(result.constraints.policyInEffect).toBeTruthy();
    });

    it("follows policy emissions", async () => {
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );
      const account = new BehaviorSubject(accounts[SomeUser]);
      const account$ = account.asObservable();
      const somePolicySubject = new BehaviorSubject([somePolicy]);
      policyService.getAll$.mockReturnValueOnce(somePolicySubject.asObservable());
      const emissions: GeneratorConstraints<SomeSettings>[] = [];
      const sub = generator
        .policy$(SomeConfiguration, { account$ })
        .subscribe((policy) => emissions.push(policy));

      // swap the active policy for an inactive policy
      somePolicySubject.next([]);
      await awaitAsync();
      sub.unsubscribe();
      const [someResult, anotherResult] = emissions;

      expect(someResult.constraints.policyInEffect).toBeTruthy();
      expect(anotherResult.constraints.policyInEffect).toBeFalsy();
    });

    it("follows user emissions", async () => {
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );
      const account = new BehaviorSubject(accounts[SomeUser]);
      const account$ = account.asObservable();
      const somePolicy$ = new BehaviorSubject([somePolicy]).asObservable();
      const anotherPolicy$ = new BehaviorSubject([]).asObservable();
      policyService.getAll$.mockReturnValueOnce(somePolicy$).mockReturnValueOnce(anotherPolicy$);
      const emissions: GeneratorConstraints<SomeSettings>[] = [];
      const sub = generator
        .policy$(SomeConfiguration, { account$ })
        .subscribe((policy) => emissions.push(policy));

      // swapping the user invokes the return for `anotherPolicy$`
      account.next(accounts[AnotherUser]);
      await awaitAsync();
      sub.unsubscribe();
      const [someResult, anotherResult] = emissions;

      expect(someResult.constraints.policyInEffect).toBeTruthy();
      expect(anotherResult.constraints.policyInEffect).toBeFalsy();
    });

    it("errors when the user errors", async () => {
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );
      const account = new BehaviorSubject(accounts[SomeUser]);
      const account$ = account.asObservable();
      const expectedError = { some: "error" };

      let actualError: any = null;
      generator.policy$(SomeConfiguration, { account$ }).subscribe({
        error: (e: unknown) => {
          actualError = e;
        },
      });
      account.error(expectedError);
      await awaitAsync();

      expect(actualError).toEqual(expectedError);
    });

    it("completes when the user completes", async () => {
      const generator = new CredentialGeneratorService(
        randomizer,
        policyService,
        apiService,
        i18nService,
        providers,
      );
      const account = new BehaviorSubject(accounts[SomeUser]);
      const account$ = account.asObservable();

      let completed = false;
      generator.policy$(SomeConfiguration, { account$ }).subscribe({
        complete: () => {
          completed = true;
        },
      });
      account.complete();
      await awaitAsync();

      expect(completed).toBeTruthy();
    });
  });
});
