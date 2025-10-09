import { mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { disabledSemanticLoggerProvider } from "@bitwarden/logging";

import { FakeAccountService, FakeStateProvider, awaitAsync } from "../../../spec";
import { Account } from "../../auth/abstractions/account.service";
import { EXTENSION_DISK, UserKeyDefinition } from "../../platform/state";
import { UserId } from "../../types/guid";
import { LegacyEncryptorProvider } from "../cryptography/legacy-encryptor-provider";
import { UserEncryptor } from "../cryptography/user-encryptor.abstraction";
import { UserStateSubjectDependencyProvider } from "../state/user-state-subject-dependency-provider";

import { Site } from "./data";
import { ExtensionRegistry } from "./extension-registry.abstraction";
import { ExtensionSite } from "./extension-site";
import { ExtensionService } from "./extension.service";
import { ExtensionMetadata, ExtensionProfileMetadata, ExtensionStorageKey } from "./type";
import { Vendor } from "./vendor/data";
import { SimpleLogin } from "./vendor/simplelogin";

const SomeUser = "some user" as UserId;
const SomeAccount = {
  id: SomeUser,
  email: "someone@example.com",
  emailVerified: true,
  name: "Someone",
};
const SomeAccount$ = new BehaviorSubject<Account>(SomeAccount);

type TestType = { foo: string };

const SomeEncryptor: UserEncryptor = {
  userId: SomeUser,

  encrypt(secret) {
    const tmp: any = secret;
    return Promise.resolve({ foo: `encrypt(${tmp.foo})` } as any);
  },

  decrypt(secret) {
    const tmp: any = JSON.parse(secret.encryptedString!);
    return Promise.resolve({ foo: `decrypt(${tmp.foo})` } as any);
  },
};

const SomeAccountService = new FakeAccountService({
  [SomeUser]: SomeAccount,
});

const SomeStateProvider = new FakeStateProvider(SomeAccountService);

const SomeProvider = {
  encryptor: {
    userEncryptor$: () => {
      return new BehaviorSubject({ encryptor: SomeEncryptor, userId: SomeUser }).asObservable();
    },
    organizationEncryptor$() {
      throw new Error("`organizationEncryptor$` should never be invoked.");
    },
  } as LegacyEncryptorProvider,
  state: SomeStateProvider,
  log: disabledSemanticLoggerProvider,
  now: Date.now,
} as UserStateSubjectDependencyProvider;

const SomeExtension: ExtensionMetadata = {
  site: { id: "forwarder", availableFields: [] },
  product: { vendor: SimpleLogin },
  host: {
    selfHost: "maybe",
    baseUrl: "https://www.example.com/",
    authentication: true,
  },
  requestedFields: [],
};

const SomeRegistry = mock<ExtensionRegistry>();

const SomeProfileMetadata = {
  type: "extension",
  site: Site.forwarder,
  storage: {
    key: "someProfile",
    options: {
      deserializer: (value) => value as TestType,
      clearOn: [],
    },
  } as ExtensionStorageKey<TestType>,
} satisfies ExtensionProfileMetadata<TestType, "forwarder">;

describe("ExtensionService", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("settings", () => {
    it("writes to the user's state", async () => {
      const extension = new ExtensionService(SomeRegistry, SomeProvider);
      SomeRegistry.extension.mockReturnValue(SomeExtension);
      const subject = extension.settings(SomeProfileMetadata, Vendor.simplelogin, {
        account$: SomeAccount$,
      });

      subject.next({ foo: "next value" });
      await awaitAsync();

      // if the write succeeded, then the storage location should contain an object;
      // the precise value isn't tested to avoid coupling the test to the storage format
      const expectedKey = new UserKeyDefinition(
        EXTENSION_DISK,
        "forwarder.simplelogin.someProfile",
        SomeProfileMetadata.storage.options,
      );
      const result = await firstValueFrom(SomeStateProvider.getUserState$(expectedKey, SomeUser));
      expect(result).toBeTruthy();
    });

    it("panics when the extension metadata isn't available", async () => {
      const extension = new ExtensionService(SomeRegistry, SomeProvider);
      expect(() =>
        extension.settings(SomeProfileMetadata, Vendor.bitwarden, { account$: SomeAccount$ }),
      ).toThrow("extension not defined");
    });
  });

  describe("site", () => {
    it("returns an extension site", () => {
      const expected = new ExtensionSite(SomeExtension.site, new Map());
      SomeRegistry.build.mockReturnValueOnce(expected);
      const extension = new ExtensionService(SomeRegistry, SomeProvider);

      const site = extension.site(Site.forwarder);

      expect(site).toEqual(expected);
    });
  });
});
