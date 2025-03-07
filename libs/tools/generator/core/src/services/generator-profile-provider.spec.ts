import { mock } from "jest-mock-extended";
import { BehaviorSubject, ReplaySubject, firstValueFrom } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { GENERATOR_DISK, UserKeyDefinition } from "@bitwarden/common/platform/state";
import { LegacyEncryptorProvider } from "@bitwarden/common/tools/cryptography/legacy-encryptor-provider";
import { UserEncryptor } from "@bitwarden/common/tools/cryptography/user-encryptor.abstraction";
import { disabledSemanticLoggerProvider } from "@bitwarden/common/tools/log";
import { PrivateClassifier } from "@bitwarden/common/tools/private-classifier";
import { IdentityConstraint } from "@bitwarden/common/tools/state/identity-state-constraint";
import { UserStateSubjectDependencyProvider } from "@bitwarden/common/tools/state/user-state-subject-dependency-provider";
import { StateConstraints } from "@bitwarden/common/tools/types";
import { OrganizationId, PolicyId, UserId } from "@bitwarden/common/types/guid";

import { FakeStateProvider, FakeAccountService, awaitAsync } from "../../../../../common/spec";
import { CoreProfileMetadata, ProfileContext } from "../metadata/profile-metadata";
import { GeneratorConstraints } from "../types";

import { GeneratorProfileProvider } from "./generator-profile-provider";

// arbitrary settings types
type SomeSettings = { foo: string };

// fake user information
const SomeUser = "SomeUser" as UserId;
const AnotherUser = "SomeOtherUser" as UserId;
const UnverifiedEmailUser = "UnverifiedEmailUser" as UserId;
const accounts: Record<UserId, Account> = {
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
  [UnverifiedEmailUser]: {
    id: UnverifiedEmailUser,
    name: "a user with an unverfied email",
    email: "unverified@example.com",
    emailVerified: false,
  },
};
const accountService = new FakeAccountService(accounts);

const policyService = mock<PolicyService>();
const somePolicy = new Policy({
  data: { fooPolicy: true },
  type: PolicyType.PasswordGenerator,
  id: "" as PolicyId,
  organizationId: "" as OrganizationId,
  enabled: true,
});

const stateProvider = new FakeStateProvider(accountService);
const encryptor = mock<UserEncryptor>();
const encryptorProvider = mock<LegacyEncryptorProvider>();

const dependencyProvider: UserStateSubjectDependencyProvider = {
  encryptor: encryptorProvider,
  state: stateProvider,
  log: disabledSemanticLoggerProvider,
};

// settings storage location
const SettingsKey = new UserKeyDefinition<SomeSettings>(GENERATOR_DISK, "SomeSettings", {
  deserializer: (value) => value,
  clearOn: [],
});

// fake the configuration
const SomeProfile: CoreProfileMetadata<SomeSettings> = {
  type: "core",
  storage: {
    target: "object",
    key: "SomeSettings",
    state: GENERATOR_DISK,
    classifier: new PrivateClassifier(),
    format: "plain",
    options: {
      deserializer: (value) => value,
      clearOn: [],
    },
    initial: { foo: "initial" },
  },
  constraints: {
    type: PolicyType.PasswordGenerator,
    default: { foo: {} },
    create: jest.fn((policies, context) => {
      const combined = policies.reduce(
        (acc, policy) => ({ fooPolicy: acc.fooPolicy || policy.data.fooPolicy }),
        { fooPolicy: false },
      );

      if (combined.fooPolicy) {
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
    }),
  },
};

const NoPolicyProfile: CoreProfileMetadata<SomeSettings> = {
  type: "core",
  storage: {
    target: "object",
    key: "SomeSettings",
    state: GENERATOR_DISK,
    classifier: new PrivateClassifier(),
    format: "classified",
    options: {
      deserializer: (value) => value,
      clearOn: [],
    },
    initial: { foo: "initial" },
  },
  constraints: {
    default: { foo: {} },
    create: jest.fn((policies, context) => new IdentityConstraint()),
  },
};

describe("GeneratorProfileProvider", () => {
  beforeEach(async () => {
    policyService.getAll$.mockImplementation(() => new BehaviorSubject([]).asObservable());
    const encryptor$ = new BehaviorSubject({ userId: SomeUser, encryptor });
    encryptorProvider.userEncryptor$.mockReturnValue(encryptor$);
    jest.clearAllMocks();
  });

  describe("settings", () => {
    it("writes to the user's state", async () => {
      const account$ = new BehaviorSubject(accounts[SomeUser]).asObservable();
      const profileProvider = new GeneratorProfileProvider(dependencyProvider, policyService);
      const settings = profileProvider.settings(SomeProfile, { account$ });

      settings.next({ foo: "next value" });
      await awaitAsync();
      const result = await firstValueFrom(stateProvider.getUserState$(SettingsKey, SomeUser));

      expect(result).toEqual({ foo: "next value" });
    });

    it("waits for the user to become available", async () => {
      await stateProvider.setUserState(SettingsKey, { foo: "initial value" }, SomeUser);
      const account = new ReplaySubject<Account>(1);
      const account$ = account.asObservable();
      const profileProvider = new GeneratorProfileProvider(dependencyProvider, policyService);

      let result: SomeSettings | undefined = undefined;
      profileProvider.settings(SomeProfile, { account$ }).subscribe({
        next(settings) {
          result = settings;
        },
      });
      await awaitAsync();
      expect(result).toBeUndefined();
      account.next(accounts[SomeUser]);
      await awaitAsync();

      // need to use `!` because TypeScript isn't aware that the subscription
      // sets `result`, and thus computes the type of `result?.userId` as `never`
      expect(result).toEqual({ foo: "initial value" });
    });
  });

  describe("constraints$", () => {
    it("creates constraints without policy in effect when there is no policy", async () => {
      const profileProvider = new GeneratorProfileProvider(dependencyProvider, policyService);
      const account$ = new BehaviorSubject(accounts[SomeUser]).asObservable();

      const result = await firstValueFrom(profileProvider.constraints$(SomeProfile, { account$ }));

      expect(result.constraints.policyInEffect).toBeFalsy();
    });

    it("creates constraints with policy in effect when there is a policy", async () => {
      const profileProvider = new GeneratorProfileProvider(dependencyProvider, policyService);
      const account$ = new BehaviorSubject(accounts[SomeUser]).asObservable();
      const policy$ = new BehaviorSubject([somePolicy]);
      policyService.getAll$.mockReturnValue(policy$);

      const result = await firstValueFrom(profileProvider.constraints$(SomeProfile, { account$ }));

      expect(result.constraints.policyInEffect).toBeTruthy();
    });

    it("sends the policy list to profile.constraint.create(...) when a type is specified", async () => {
      const profileProvider = new GeneratorProfileProvider(dependencyProvider, policyService);
      const account$ = new BehaviorSubject(accounts[SomeUser]).asObservable();
      const expectedPolicy = [somePolicy];
      const policy$ = new BehaviorSubject(expectedPolicy);
      policyService.getAll$.mockReturnValue(policy$);

      await firstValueFrom(profileProvider.constraints$(SomeProfile, { account$ }));

      expect(SomeProfile.constraints.create).toHaveBeenCalledWith(
        expectedPolicy,
        expect.any(Object),
      );
    });

    it("sends an empty policy list to profile.constraint.create(...) when a type is omitted", async () => {
      const profileProvider = new GeneratorProfileProvider(dependencyProvider, policyService);
      const account$ = new BehaviorSubject(accounts[SomeUser]).asObservable();

      await firstValueFrom(profileProvider.constraints$(NoPolicyProfile, { account$ }));

      expect(NoPolicyProfile.constraints.create).toHaveBeenCalledWith([], expect.any(Object));
    });

    it("sends the context to profile.constraint.create(...)", async () => {
      const profileProvider = new GeneratorProfileProvider(dependencyProvider, policyService);
      const account$ = new BehaviorSubject(accounts[SomeUser]).asObservable();
      const expectedContext: ProfileContext<SomeSettings> = {
        defaultConstraints: NoPolicyProfile.constraints.default,
        email: accounts[SomeUser].email,
      };

      await firstValueFrom(profileProvider.constraints$(NoPolicyProfile, { account$ }));

      expect(NoPolicyProfile.constraints.create).toHaveBeenCalledWith(
        expect.any(Array),
        expectedContext,
      );
    });

    it("omits nonverified emails from the context sent to profile.constraint.create(...)", async () => {
      const profileProvider = new GeneratorProfileProvider(dependencyProvider, policyService);
      const account$ = new BehaviorSubject(accounts[UnverifiedEmailUser]).asObservable();
      const expectedContext: ProfileContext<SomeSettings> = {
        defaultConstraints: NoPolicyProfile.constraints.default,
      };

      await firstValueFrom(profileProvider.constraints$(NoPolicyProfile, { account$ }));

      expect(NoPolicyProfile.constraints.create).toHaveBeenCalledWith(
        expect.any(Array),
        expectedContext,
      );
    });

    // FIXME: implement this test case once the fake account service mock supports email verification
    it.todo("invokes profile.constraint.create(...) when the user's email address is verified");

    // FIXME: implement this test case once the fake account service mock supports email updates
    it.todo("invokes profile.constraint.create(...) when the user's email address changes");

    it("follows policy emissions", async () => {
      const profileProvider = new GeneratorProfileProvider(dependencyProvider, policyService);
      const account = new BehaviorSubject(accounts[SomeUser]);
      const account$ = account.asObservable();
      const somePolicySubject = new BehaviorSubject([somePolicy]);
      policyService.getAll$.mockReturnValueOnce(somePolicySubject.asObservable());
      const emissions: GeneratorConstraints<SomeSettings>[] = [];
      const sub = profileProvider
        .constraints$(SomeProfile, { account$ })
        .subscribe((policy) => emissions.push(policy));

      // swap the active policy for an inactive policy
      somePolicySubject.next([]);
      await awaitAsync();
      sub.unsubscribe();
      const [someResult, anotherResult] = emissions;

      expect(someResult.constraints.policyInEffect).toBeTruthy();
      expect(anotherResult.constraints.policyInEffect).toBeFalsy();
    });

    it("errors when the user errors", async () => {
      const profileProvider = new GeneratorProfileProvider(dependencyProvider, policyService);
      const account = new BehaviorSubject(accounts[SomeUser]);
      const account$ = account.asObservable();
      const expectedError = { some: "error" };

      let actualError: any = null;
      profileProvider.constraints$(SomeProfile, { account$ }).subscribe({
        error: (e: unknown) => {
          actualError = e;
        },
      });
      account.error(expectedError);
      await awaitAsync();

      expect(actualError).toEqual(expectedError);
    });

    it("completes when the user completes", async () => {
      const profileProvider = new GeneratorProfileProvider(dependencyProvider, policyService);
      const account = new BehaviorSubject(accounts[SomeUser]);
      const account$ = account.asObservable();

      let completed = false;
      profileProvider.constraints$(SomeProfile, { account$ }).subscribe({
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
