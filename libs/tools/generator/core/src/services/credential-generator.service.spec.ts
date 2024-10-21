import { mock } from "jest-mock-extended";
import { BehaviorSubject, filter, firstValueFrom, Subject } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { GENERATOR_DISK, UserKeyDefinition } from "@bitwarden/common/platform/state";
import { StateConstraints } from "@bitwarden/common/tools/types";
import { OrganizationId, PolicyId, UserId } from "@bitwarden/common/types/guid";

import {
  FakeStateProvider,
  FakeAccountService,
  awaitAsync,
  ObservableTracker,
} from "../../../../../common/spec";
import { Randomizer } from "../abstractions";
import { SshKeyNativeGenerator } from "../abstractions/sshkey-native-generator.abstraction";
import { Generators } from "../data";
import {
  CredentialGeneratorConfiguration,
  GeneratedCredential,
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
const sshKeyNativeGeneratorService = mock<SshKeyNativeGenerator>();
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

// fake the configuration
const SomeConfiguration: CredentialGeneratorConfiguration<SomeSettings, SomePolicy> = {
  id: SomeAlgorithm,
  category: SomeCategory,
  nameKey: SomeNameKey,
  onlyOnRequest: false,
  engine: {
    create: (randomizer) => {
      return {
        generate: (request, _algorithm, settings) => {
          const credential = request.website ? `${request.website}|${settings.foo}` : settings.foo;
          const result = new GeneratedCredential(credential, SomeAlgorithm, SomeTime);
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
    name: "some user",
    email: "some.user@example.com",
    emailVerified: true,
  },
  [AnotherUser]: {
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

describe("CredentialGeneratorService", () => {
  beforeEach(async () => {
    await accountService.switchAccount(SomeUser);
    policyService.getAll$.mockImplementation(() => new BehaviorSubject([]).asObservable());
    jest.clearAllMocks();
  });

  describe("generate$", () => {
    it("emits a generation for the active user when subscribed", async () => {
      const settings = { foo: "value" };
      await stateProvider.setUserState(SettingsKey, settings, SomeUser);
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );
      const generated = new ObservableTracker(generator.generate$(SomeConfiguration));

      const result = await generated.expectEmission();

      expect(result).toEqual(new GeneratedCredential("value", SomeAlgorithm, SomeTime));
    });

    it("follows the active user", async () => {
      const someSettings = { foo: "some value" };
      const anotherSettings = { foo: "another value" };
      await stateProvider.setUserState(SettingsKey, someSettings, SomeUser);
      await stateProvider.setUserState(SettingsKey, anotherSettings, AnotherUser);
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );
      const generated = new ObservableTracker(generator.generate$(SomeConfiguration));

      await accountService.switchAccount(AnotherUser);
      await generated.pauseUntilReceived(2);
      generated.unsubscribe();

      expect(generated.emissions).toEqual([
        new GeneratedCredential("some value", SomeAlgorithm, SomeTime),
        new GeneratedCredential("another value", SomeAlgorithm, SomeTime),
      ]);
    });

    it("emits a generation when the settings change", async () => {
      const someSettings = { foo: "some value" };
      const anotherSettings = { foo: "another value" };
      await stateProvider.setUserState(SettingsKey, someSettings, SomeUser);
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );
      const generated = new ObservableTracker(generator.generate$(SomeConfiguration));

      await stateProvider.setUserState(SettingsKey, anotherSettings, SomeUser);
      await generated.pauseUntilReceived(2);
      generated.unsubscribe();

      expect(generated.emissions).toEqual([
        new GeneratedCredential("some value", SomeAlgorithm, SomeTime),
        new GeneratedCredential("another value", SomeAlgorithm, SomeTime),
      ]);
    });

    // FIXME: test these when the fake state provider can create the required emissions
    it.todo("errors when the settings error");
    it.todo("completes when the settings complete");

    it("includes `website$`'s last emitted value", async () => {
      const settings = { foo: "value" };
      await stateProvider.setUserState(SettingsKey, settings, SomeUser);
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );
      const website$ = new BehaviorSubject("some website");
      const generated = new ObservableTracker(generator.generate$(SomeConfiguration, { website$ }));

      const result = await generated.expectEmission();

      expect(result).toEqual(
        new GeneratedCredential("some website|value", SomeAlgorithm, SomeTime),
      );
    });

    it("errors when `website$` errors", async () => {
      await stateProvider.setUserState(SettingsKey, null, SomeUser);
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );
      const website$ = new BehaviorSubject("some website");
      let error = null;

      generator.generate$(SomeConfiguration, { website$ }).subscribe({
        error: (e: unknown) => {
          error = e;
        },
      });
      website$.error({ some: "error" });
      await awaitAsync();

      expect(error).toEqual({ some: "error" });
    });

    it("completes when `website$` completes", async () => {
      await stateProvider.setUserState(SettingsKey, null, SomeUser);
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );
      const website$ = new BehaviorSubject("some website");
      let completed = false;

      generator.generate$(SomeConfiguration, { website$ }).subscribe({
        complete: () => {
          completed = true;
        },
      });
      website$.complete();
      await awaitAsync();

      expect(completed).toBeTruthy();
    });

    it("emits a generation for a specific user when `user$` supplied", async () => {
      await stateProvider.setUserState(SettingsKey, { foo: "value" }, SomeUser);
      await stateProvider.setUserState(SettingsKey, { foo: "another" }, AnotherUser);
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );
      const userId$ = new BehaviorSubject(AnotherUser).asObservable();
      const generated = new ObservableTracker(generator.generate$(SomeConfiguration, { userId$ }));

      const result = await generated.expectEmission();

      expect(result).toEqual(new GeneratedCredential("another", SomeAlgorithm, SomeTime));
    });

    it("emits a generation for a specific user when `user$` emits", async () => {
      await stateProvider.setUserState(SettingsKey, { foo: "value" }, SomeUser);
      await stateProvider.setUserState(SettingsKey, { foo: "another" }, AnotherUser);
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );
      const userId = new BehaviorSubject(SomeUser);
      const userId$ = userId.pipe(filter((u) => !!u));
      const generated = new ObservableTracker(generator.generate$(SomeConfiguration, { userId$ }));

      userId.next(AnotherUser);
      const result = await generated.pauseUntilReceived(2);

      expect(result).toEqual([
        new GeneratedCredential("value", SomeAlgorithm, SomeTime),
        new GeneratedCredential("another", SomeAlgorithm, SomeTime),
      ]);
    });

    it("errors when `user$` errors", async () => {
      await stateProvider.setUserState(SettingsKey, null, SomeUser);
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );
      const userId$ = new BehaviorSubject(SomeUser);
      let error = null;

      generator.generate$(SomeConfiguration, { userId$ }).subscribe({
        error: (e: unknown) => {
          error = e;
        },
      });
      userId$.error({ some: "error" });
      await awaitAsync();

      expect(error).toEqual({ some: "error" });
    });

    it("completes when `user$` completes", async () => {
      await stateProvider.setUserState(SettingsKey, null, SomeUser);
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );
      const userId$ = new BehaviorSubject(SomeUser);
      let completed = false;

      generator.generate$(SomeConfiguration, { userId$ }).subscribe({
        complete: () => {
          completed = true;
        },
      });
      userId$.complete();
      await awaitAsync();

      expect(completed).toBeTruthy();
    });

    it("emits a generation only when `on$` emits", async () => {
      // This test breaks from arrange/act/assert because it is testing causality
      await stateProvider.setUserState(SettingsKey, { foo: "value" }, SomeUser);
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );
      const on$ = new Subject<void>();
      const results: any[] = [];

      // confirm no emission during subscription
      const sub = generator
        .generate$(SomeConfiguration, { on$ })
        .subscribe((result) => results.push(result));
      await awaitAsync();
      expect(results.length).toEqual(0);

      // confirm forwarded emission
      on$.next();
      await awaitAsync();
      expect(results).toEqual([new GeneratedCredential("value", SomeAlgorithm, SomeTime)]);

      // confirm updating settings does not cause an emission
      await stateProvider.setUserState(SettingsKey, { foo: "next" }, SomeUser);
      await awaitAsync();
      expect(results.length).toBe(1);

      // confirm forwarded emission takes latest value
      on$.next();
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
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );
      const on$ = new Subject<void>();
      let error: any = null;

      // confirm no emission during subscription
      generator.generate$(SomeConfiguration, { on$ }).subscribe({
        error: (e: unknown) => {
          error = e;
        },
      });
      on$.error({ some: "error" });
      await awaitAsync();

      expect(error).toEqual({ some: "error" });
    });

    it("completes when `on$` completes", async () => {
      await stateProvider.setUserState(SettingsKey, { foo: "value" }, SomeUser);
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );
      const on$ = new Subject<void>();
      let complete = false;

      // confirm no emission during subscription
      generator.generate$(SomeConfiguration, { on$ }).subscribe({
        complete: () => {
          complete = true;
        },
      });
      on$.complete();
      await awaitAsync();

      expect(complete).toBeTruthy();
    });

    // FIXME: test these when the fake state provider can delay its first emission
    it.todo("emits when settings$ become available if on$ is called before they're ready.");
    it.todo("emits when website$ become available if on$ is called before they're ready.");
  });

  describe("algorithms", () => {
    it("outputs password generation metadata", () => {
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );

      const result = generator.algorithms("password");

      expect(result).toContain(Generators.password);
      expect(result).toContain(Generators.passphrase);

      // this test shouldn't contain entries outside of the current category
      expect(result).not.toContain(Generators.username);
      expect(result).not.toContain(Generators.catchall);
    });

    it("outputs username generation metadata", () => {
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );

      const result = generator.algorithms("username");

      expect(result).toContain(Generators.username);

      // this test shouldn't contain entries outside of the current category
      expect(result).not.toContain(Generators.catchall);
      expect(result).not.toContain(Generators.password);
    });

    it("outputs email generation metadata", () => {
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );

      const result = generator.algorithms("email");

      expect(result).toContain(Generators.catchall);
      expect(result).toContain(Generators.subaddress);

      // this test shouldn't contain entries outside of the current category
      expect(result).not.toContain(Generators.username);
      expect(result).not.toContain(Generators.password);
    });

    it("combines metadata across categories", () => {
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );

      const result = generator.algorithms(["username", "email"]);

      expect(result).toContain(Generators.username);
      expect(result).toContain(Generators.catchall);
      expect(result).toContain(Generators.subaddress);

      // this test shouldn't contain entries outside of the current categories
      expect(result).not.toContain(Generators.password);
    });
  });

  describe("algorithms$", () => {
    // these tests cannot use the observable tracker because they return
    //  data that cannot be cloned
    it("returns password metadata", async () => {
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );

      const result = await firstValueFrom(generator.algorithms$("password"));

      expect(result).toContain(Generators.password);
      expect(result).toContain(Generators.passphrase);
    });

    it("returns username metadata", async () => {
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );

      const result = await firstValueFrom(generator.algorithms$("username"));

      expect(result).toContain(Generators.username);
    });

    it("returns email metadata", async () => {
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );

      const result = await firstValueFrom(generator.algorithms$("email"));

      expect(result).toContain(Generators.catchall);
      expect(result).toContain(Generators.subaddress);
    });

    it("returns username and email metadata", async () => {
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );

      const result = await firstValueFrom(generator.algorithms$(["username", "email"]));

      expect(result).toContain(Generators.username);
      expect(result).toContain(Generators.catchall);
      expect(result).toContain(Generators.subaddress);
    });

    // Subsequent tests focus on passwords and passphrases as an example of policy
    // awareness; they exercise the logic without being comprehensive
    it("enforces the active user's policy", async () => {
      const policy$ = new BehaviorSubject([passwordOverridePolicy]);
      policyService.getAll$.mockReturnValue(policy$);
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );

      const result = await firstValueFrom(generator.algorithms$(["password"]));

      expect(policyService.getAll$).toHaveBeenCalledWith(PolicyType.PasswordGenerator, SomeUser);
      expect(result).toContain(Generators.password);
      expect(result).not.toContain(Generators.passphrase);
    });

    it("follows changes to the active user", async () => {
      // initialize local account service and state provider because this test is sensitive
      // to some shared data in `FakeAccountService`.
      const accountService = new FakeAccountService(accounts);
      const stateProvider = new FakeStateProvider(accountService);
      await accountService.switchAccount(SomeUser);
      policyService.getAll$.mockReturnValueOnce(new BehaviorSubject([passwordOverridePolicy]));
      policyService.getAll$.mockReturnValueOnce(new BehaviorSubject([passphraseOverridePolicy]));
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );
      const results: any = [];
      const sub = generator.algorithms$("password").subscribe((r) => results.push(r));

      await accountService.switchAccount(AnotherUser);
      await awaitAsync();
      sub.unsubscribe();

      const [someResult, anotherResult] = results;

      expect(policyService.getAll$).toHaveBeenNthCalledWith(
        1,
        PolicyType.PasswordGenerator,
        SomeUser,
      );
      expect(someResult).toContain(Generators.password);
      expect(someResult).not.toContain(Generators.passphrase);

      expect(policyService.getAll$).toHaveBeenNthCalledWith(
        2,
        PolicyType.PasswordGenerator,
        AnotherUser,
      );
      expect(anotherResult).toContain(Generators.passphrase);
      expect(anotherResult).not.toContain(Generators.password);
    });

    it("reads an arbitrary user's settings", async () => {
      policyService.getAll$.mockReturnValueOnce(new BehaviorSubject([passwordOverridePolicy]));
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );
      const userId$ = new BehaviorSubject(AnotherUser).asObservable();

      const result = await firstValueFrom(generator.algorithms$("password", { userId$ }));

      expect(policyService.getAll$).toHaveBeenCalledWith(PolicyType.PasswordGenerator, AnotherUser);
      expect(result).toContain(Generators.password);
      expect(result).not.toContain(Generators.passphrase);
    });

    it("follows changes to the arbitrary user", async () => {
      policyService.getAll$.mockReturnValueOnce(new BehaviorSubject([passwordOverridePolicy]));
      policyService.getAll$.mockReturnValueOnce(new BehaviorSubject([passphraseOverridePolicy]));
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );
      const userId = new BehaviorSubject(SomeUser);
      const userId$ = userId.asObservable();
      const results: any = [];
      const sub = generator.algorithms$("password", { userId$ }).subscribe((r) => results.push(r));

      userId.next(AnotherUser);
      await awaitAsync();
      sub.unsubscribe();

      const [someResult, anotherResult] = results;
      expect(policyService.getAll$).toHaveBeenCalledWith(PolicyType.PasswordGenerator, SomeUser);
      expect(someResult).toContain(Generators.password);
      expect(someResult).not.toContain(Generators.passphrase);

      expect(policyService.getAll$).toHaveBeenCalledWith(PolicyType.PasswordGenerator, AnotherUser);
      expect(anotherResult).toContain(Generators.passphrase);
      expect(anotherResult).not.toContain(Generators.password);
    });

    it("errors when the arbitrary user's stream errors", async () => {
      policyService.getAll$.mockReturnValueOnce(new BehaviorSubject([passwordOverridePolicy]));
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );
      const userId = new BehaviorSubject(SomeUser);
      const userId$ = userId.asObservable();
      let error = null;

      generator.algorithms$("password", { userId$ }).subscribe({
        error: (e: unknown) => {
          error = e;
        },
      });
      userId.error({ some: "error" });
      await awaitAsync();

      expect(error).toEqual({ some: "error" });
    });

    it("completes when the arbitrary user's stream completes", async () => {
      policyService.getAll$.mockReturnValueOnce(new BehaviorSubject([passwordOverridePolicy]));
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );
      const userId = new BehaviorSubject(SomeUser);
      const userId$ = userId.asObservable();
      let completed = false;

      generator.algorithms$("password", { userId$ }).subscribe({
        complete: () => {
          completed = true;
        },
      });
      userId.complete();
      await awaitAsync();

      expect(completed).toBeTruthy();
    });

    it("ignores repeated arbitrary user emissions", async () => {
      policyService.getAll$.mockReturnValueOnce(new BehaviorSubject([passwordOverridePolicy]));
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );
      const userId = new BehaviorSubject(SomeUser);
      const userId$ = userId.asObservable();
      let count = 0;

      const sub = generator.algorithms$("password", { userId$ }).subscribe({
        next: () => {
          count++;
        },
      });
      await awaitAsync();
      userId.next(SomeUser);
      await awaitAsync();
      userId.next(SomeUser);
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
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );

      const result = await firstValueFrom(generator.settings$(SomeConfiguration));

      expect(result).toEqual(SomeConfiguration.settings.initial);
    });

    it("reads from the active user's configuration-defined storage", async () => {
      const settings = { foo: "value" };
      await stateProvider.setUserState(SettingsKey, settings, SomeUser);
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );

      const result = await firstValueFrom(generator.settings$(SomeConfiguration));

      expect(result).toEqual(settings);
    });

    it("applies policy to the loaded settings", async () => {
      const settings = { foo: "value" };
      await stateProvider.setUserState(SettingsKey, settings, SomeUser);
      const policy$ = new BehaviorSubject([somePolicy]);
      policyService.getAll$.mockReturnValue(policy$);
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );

      const result = await firstValueFrom(generator.settings$(SomeConfiguration));

      expect(result).toEqual({ foo: "adjusted(value)" });
    });

    it("follows changes to the active user", async () => {
      // initialize local accound service and state provider because this test is sensitive
      // to some shared data in `FakeAccountService`.
      const accountService = new FakeAccountService(accounts);
      const stateProvider = new FakeStateProvider(accountService);
      await accountService.switchAccount(SomeUser);
      const someSettings = { foo: "value" };
      const anotherSettings = { foo: "another" };
      await stateProvider.setUserState(SettingsKey, someSettings, SomeUser);
      await stateProvider.setUserState(SettingsKey, anotherSettings, AnotherUser);
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );
      const results: any = [];
      const sub = generator.settings$(SomeConfiguration).subscribe((r) => results.push(r));

      await accountService.switchAccount(AnotherUser);
      await awaitAsync();
      sub.unsubscribe();

      const [someResult, anotherResult] = results;
      expect(someResult).toEqual(someSettings);
      expect(anotherResult).toEqual(anotherSettings);
    });

    it("reads an arbitrary user's settings", async () => {
      await stateProvider.setUserState(SettingsKey, { foo: "value" }, SomeUser);
      const anotherSettings = { foo: "another" };
      await stateProvider.setUserState(SettingsKey, anotherSettings, AnotherUser);
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );
      const userId$ = new BehaviorSubject(AnotherUser).asObservable();

      const result = await firstValueFrom(generator.settings$(SomeConfiguration, { userId$ }));

      expect(result).toEqual(anotherSettings);
    });

    it("follows changes to the arbitrary user", async () => {
      const someSettings = { foo: "value" };
      await stateProvider.setUserState(SettingsKey, someSettings, SomeUser);
      const anotherSettings = { foo: "another" };
      await stateProvider.setUserState(SettingsKey, anotherSettings, AnotherUser);
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );
      const userId = new BehaviorSubject(SomeUser);
      const userId$ = userId.asObservable();
      const results: any = [];
      const sub = generator
        .settings$(SomeConfiguration, { userId$ })
        .subscribe((r) => results.push(r));

      userId.next(AnotherUser);
      await awaitAsync();
      sub.unsubscribe();

      const [someResult, anotherResult] = results;
      expect(someResult).toEqual(someSettings);
      expect(anotherResult).toEqual(anotherSettings);
    });

    it("errors when the arbitrary user's stream errors", async () => {
      await stateProvider.setUserState(SettingsKey, null, SomeUser);
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );
      const userId = new BehaviorSubject(SomeUser);
      const userId$ = userId.asObservable();
      let error = null;

      generator.settings$(SomeConfiguration, { userId$ }).subscribe({
        error: (e: unknown) => {
          error = e;
        },
      });
      userId.error({ some: "error" });
      await awaitAsync();

      expect(error).toEqual({ some: "error" });
    });

    it("completes when the arbitrary user's stream completes", async () => {
      await stateProvider.setUserState(SettingsKey, null, SomeUser);
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );
      const userId = new BehaviorSubject(SomeUser);
      const userId$ = userId.asObservable();
      let completed = false;

      generator.settings$(SomeConfiguration, { userId$ }).subscribe({
        complete: () => {
          completed = true;
        },
      });
      userId.complete();
      await awaitAsync();

      expect(completed).toBeTruthy();
    });

    it("ignores repeated arbitrary user emissions", async () => {
      await stateProvider.setUserState(SettingsKey, null, SomeUser);
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );
      const userId = new BehaviorSubject(SomeUser);
      const userId$ = userId.asObservable();
      let count = 0;

      const sub = generator.settings$(SomeConfiguration, { userId$ }).subscribe({
        next: () => {
          count++;
        },
      });
      await awaitAsync();
      userId.next(SomeUser);
      await awaitAsync();
      userId.next(SomeUser);
      await awaitAsync();
      sub.unsubscribe();

      expect(count).toEqual(1);
    });
  });

  describe("settings", () => {
    it("writes to the user's state", async () => {
      const singleUserId$ = new BehaviorSubject(SomeUser).asObservable();
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );
      const subject = await generator.settings(SomeConfiguration, { singleUserId$ });

      subject.next({ foo: "next value" });
      await awaitAsync();
      const result = await firstValueFrom(stateProvider.getUserState$(SettingsKey, SomeUser));

      expect(result).toEqual({ foo: "next value" });
    });

    it("waits for the user to become available", async () => {
      const singleUserId = new BehaviorSubject(null);
      const singleUserId$ = singleUserId.asObservable();
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );

      let completed = false;
      const promise = generator.settings(SomeConfiguration, { singleUserId$ }).then((settings) => {
        completed = true;
        return settings;
      });
      await awaitAsync();
      expect(completed).toBeFalsy();
      singleUserId.next(SomeUser);
      const result = await promise;

      expect(result.userId).toEqual(SomeUser);
    });
  });

  describe("policy$", () => {
    it("creates constraints without policy in effect when there is no policy", async () => {
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );
      const userId$ = new BehaviorSubject(SomeUser).asObservable();

      const result = await firstValueFrom(generator.policy$(SomeConfiguration, { userId$ }));

      expect(result.constraints.policyInEffect).toBeFalsy();
    });

    it("creates constraints with policy in effect when there is a policy", async () => {
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );
      const userId$ = new BehaviorSubject(SomeUser).asObservable();
      const policy$ = new BehaviorSubject([somePolicy]);
      policyService.getAll$.mockReturnValue(policy$);

      const result = await firstValueFrom(generator.policy$(SomeConfiguration, { userId$ }));

      expect(result.constraints.policyInEffect).toBeTruthy();
    });

    it("follows policy emissions", async () => {
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );
      const userId = new BehaviorSubject(SomeUser);
      const userId$ = userId.asObservable();
      const somePolicySubject = new BehaviorSubject([somePolicy]);
      policyService.getAll$.mockReturnValueOnce(somePolicySubject.asObservable());
      const emissions: GeneratorConstraints<SomeSettings>[] = [];
      const sub = generator
        .policy$(SomeConfiguration, { userId$ })
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
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );
      const userId = new BehaviorSubject(SomeUser);
      const userId$ = userId.asObservable();
      const somePolicy$ = new BehaviorSubject([somePolicy]).asObservable();
      const anotherPolicy$ = new BehaviorSubject([]).asObservable();
      policyService.getAll$.mockReturnValueOnce(somePolicy$).mockReturnValueOnce(anotherPolicy$);
      const emissions: GeneratorConstraints<SomeSettings>[] = [];
      const sub = generator
        .policy$(SomeConfiguration, { userId$ })
        .subscribe((policy) => emissions.push(policy));

      // swapping the user invokes the return for `anotherPolicy$`
      userId.next(AnotherUser);
      await awaitAsync();
      sub.unsubscribe();
      const [someResult, anotherResult] = emissions;

      expect(someResult.constraints.policyInEffect).toBeTruthy();
      expect(anotherResult.constraints.policyInEffect).toBeFalsy();
    });

    it("errors when the user errors", async () => {
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );
      const userId = new BehaviorSubject(SomeUser);
      const userId$ = userId.asObservable();
      const expectedError = { some: "error" };

      let actualError: any = null;
      generator.policy$(SomeConfiguration, { userId$ }).subscribe({
        error: (e: unknown) => {
          actualError = e;
        },
      });
      userId.error(expectedError);
      await awaitAsync();

      expect(actualError).toEqual(expectedError);
    });

    it("completes when the user completes", async () => {
      const generator = new CredentialGeneratorService(
        randomizer,
        stateProvider,
        policyService,
        sshKeyNativeGeneratorService,
      );
      const userId = new BehaviorSubject(SomeUser);
      const userId$ = userId.asObservable();

      let completed = false;
      generator.policy$(SomeConfiguration, { userId$ }).subscribe({
        complete: () => {
          completed = true;
        },
      });
      userId.complete();
      await awaitAsync();

      expect(completed).toBeTruthy();
    });
  });
});
