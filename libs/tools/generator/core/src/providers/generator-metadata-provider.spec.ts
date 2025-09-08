import { mock } from "jest-mock-extended";
import { BehaviorSubject, ReplaySubject, firstValueFrom } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LegacyEncryptorProvider } from "@bitwarden/common/tools/cryptography/legacy-encryptor-provider";
import { UserEncryptor } from "@bitwarden/common/tools/cryptography/user-encryptor.abstraction";
import {
  ExtensionMetadata,
  ExtensionSite,
  Site,
  SiteId,
  SiteMetadata,
} from "@bitwarden/common/tools/extension";
import { ExtensionService } from "@bitwarden/common/tools/extension/extension.service";
import { Bitwarden } from "@bitwarden/common/tools/extension/vendor/bitwarden";
import { disabledSemanticLoggerProvider } from "@bitwarden/common/tools/log";
import { SystemServiceProvider } from "@bitwarden/common/tools/providers";
import { UserStateSubject } from "@bitwarden/common/tools/state/user-state-subject";
import { UserStateSubjectDependencyProvider } from "@bitwarden/common/tools/state/user-state-subject-dependency-provider";
import { deepFreeze } from "@bitwarden/common/tools/util";
import { UserId } from "@bitwarden/common/types/guid";
import { BitwardenClient } from "@bitwarden/sdk-internal";

import { FakeAccountService, FakeStateProvider } from "../../../../../common/spec";
import { Algorithm, AlgorithmsByType, CredentialAlgorithm, Type, Types } from "../metadata";
import catchall from "../metadata/email/catchall";
import plusAddress from "../metadata/email/plus-address";
import passphrase from "../metadata/password/eff-word-list";
import password from "../metadata/password/random-password";
import effWordList from "../metadata/username/eff-word-list";
import { CredentialPreference } from "../types";

import { PREFERENCES } from "./credential-preferences";
import { GeneratorMetadataProvider } from "./generator-metadata-provider";

const SomeUser = "some user" as UserId;
const SomeAccount = {
  id: SomeUser,
  email: "someone@example.com",
  emailVerified: true,
  name: "Someone",
};
const SomeAccount$ = new BehaviorSubject<Account>(SomeAccount);

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

const SystemProvider = {
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

const SomeSiteId: SiteId = Site.forwarder;

const SomeSite: SiteMetadata = Object.freeze({
  id: SomeSiteId,
  availableFields: [],
});

const SomePolicyService = mock<PolicyService>();

const SomeExtensionService = mock<ExtensionService>();

const SomeConfigService = mock<ConfigService>;

const SomeSdkService = mock<BitwardenClient>;

const ApplicationProvider = {
  /** Policy configured by the administrative console */
  policy: SomePolicyService,

  /** Client extension metadata and profile access */
  extension: SomeExtensionService,

  /** Event monitoring and diagnostic interfaces */
  log: disabledSemanticLoggerProvider,

  /** Feature flag retrieval */
  configService: SomeConfigService,

  /** SDK access for password generation */
  sdk: SomeSdkService,
} as unknown as SystemServiceProvider;

describe("GeneratorMetadataProvider", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    SomeExtensionService.site.mockImplementation(() => new ExtensionSite(SomeSite, new Map()));
  });

  describe("constructor", () => {
    it("throws when the forwarder site isn't defined by the extension service", () => {
      SomeExtensionService.site.mockReturnValue(undefined);
      expect(() => new GeneratorMetadataProvider(SystemProvider, ApplicationProvider, [])).toThrow(
        "forwarder extension site not found",
      );
    });
  });

  describe("metadata", () => {
    it("returns algorithm metadata", async () => {
      const provider = new GeneratorMetadataProvider(SystemProvider, ApplicationProvider, [
        password,
      ]);

      const metadata = provider.metadata(password.id);

      expect(metadata).toEqual(password);
    });

    it("returns forwarder metadata", async () => {
      const extensionMetadata: ExtensionMetadata = {
        site: SomeSite,
        product: { vendor: Bitwarden },
        host: { authentication: true, selfHost: "maybe", baseUrl: "https://www.example.com" },
        requestedFields: [],
      };
      const application = {
        ...ApplicationProvider,
        extension: mock<ExtensionService>({
          site: () => new ExtensionSite(SomeSite, new Map([[Bitwarden.id, extensionMetadata]])),
        }),
      };
      const provider = new GeneratorMetadataProvider(SystemProvider, application, []);

      const metadata = provider.metadata({ forwarder: Bitwarden.id });

      expect(metadata.id).toEqual({ forwarder: Bitwarden.id });
    });

    it("panics when metadata not found", async () => {
      const provider = new GeneratorMetadataProvider(SystemProvider, ApplicationProvider, []);

      expect(() => provider.metadata("not found" as any)).toThrow("metadata not found");
    });

    it("panics when an extension not found", async () => {
      const provider = new GeneratorMetadataProvider(SystemProvider, ApplicationProvider, []);

      expect(() => provider.metadata({ forwarder: "not found" as any })).toThrow(
        "extension not found",
      );
    });
  });

  describe("types", () => {
    it("returns the credential types", async () => {
      const provider = new GeneratorMetadataProvider(SystemProvider, ApplicationProvider, []);

      const result = provider.types();

      expect(result).toEqual(expect.arrayContaining(Types));
    });
  });

  describe("algorithms", () => {
    it("returns the password category's algorithms", () => {
      const provider = new GeneratorMetadataProvider(SystemProvider, ApplicationProvider, []);

      const result = provider.algorithms({ type: Type.password });

      expect(result).toEqual(expect.arrayContaining(AlgorithmsByType[Type.password]));
    });

    it("returns the username category's algorithms", () => {
      const provider = new GeneratorMetadataProvider(SystemProvider, ApplicationProvider, []);

      const result = provider.algorithms({ type: Type.username });

      expect(result).toEqual(expect.arrayContaining(AlgorithmsByType[Type.username]));
    });

    it("returns the email category's algorithms", () => {
      const provider = new GeneratorMetadataProvider(SystemProvider, ApplicationProvider, []);

      const result = provider.algorithms({ type: Type.email });

      expect(result).toEqual(expect.arrayContaining(AlgorithmsByType[Type.email]));
    });

    it("includes forwarder vendors in the email category's algorithms", () => {
      const extensionMetadata: ExtensionMetadata = {
        site: SomeSite,
        product: { vendor: Bitwarden },
        host: { authentication: true, selfHost: "maybe", baseUrl: "https://www.example.com" },
        requestedFields: [],
      };
      const application = {
        ...ApplicationProvider,
        extension: mock<ExtensionService>({
          site: () => new ExtensionSite(SomeSite, new Map([[Bitwarden.id, extensionMetadata]])),
        }),
      };
      const provider = new GeneratorMetadataProvider(SystemProvider, application, []);

      const result = provider.algorithms({ type: Type.email });

      expect(result).toEqual(expect.arrayContaining([{ forwarder: Bitwarden.id }]));
    });

    it.each([
      [Algorithm.catchall],
      [Algorithm.passphrase],
      [Algorithm.password],
      [Algorithm.plusAddress],
      [Algorithm.username],
    ])("returns explicit algorithms (=%p)", (algorithm) => {
      const provider = new GeneratorMetadataProvider(SystemProvider, ApplicationProvider, []);

      const result = provider.algorithms({ algorithm });

      expect(result).toEqual([algorithm]);
    });

    it("returns explicit forwarders", () => {
      const extensionMetadata: ExtensionMetadata = {
        site: SomeSite,
        product: { vendor: Bitwarden },
        host: { authentication: true, selfHost: "maybe", baseUrl: "https://www.example.com" },
        requestedFields: [],
      };
      const application = {
        ...ApplicationProvider,
        extension: mock<ExtensionService>({
          site: () => new ExtensionSite(SomeSite, new Map([[Bitwarden.id, extensionMetadata]])),
        }),
      };
      const provider = new GeneratorMetadataProvider(SystemProvider, application, []);

      const result = provider.algorithms({ algorithm: { forwarder: Bitwarden.id } });

      expect(result).toEqual(expect.arrayContaining([{ forwarder: Bitwarden.id }]));
    });

    it("returns an empty array when the algorithm is invalid", () => {
      const provider = new GeneratorMetadataProvider(SystemProvider, ApplicationProvider, []);

      // `any` cast required because this test subverts the type system
      const result = provider.algorithms({ algorithm: "an invalid algorithm" as any });

      expect(result).toEqual([]);
    });

    it("returns an empty array when the forwarder is invalid", () => {
      const extensionMetadata: ExtensionMetadata = {
        site: SomeSite,
        product: { vendor: Bitwarden },
        host: { authentication: true, selfHost: "maybe", baseUrl: "https://www.example.com" },
        requestedFields: [],
      };
      const application = {
        ...ApplicationProvider,
        extension: mock<ExtensionService>({
          site: () => new ExtensionSite(SomeSite, new Map([[Bitwarden.id, extensionMetadata]])),
        }),
      };
      const provider = new GeneratorMetadataProvider(SystemProvider, application, []);

      // `any` cast required because this test subverts the type system
      const result = provider.algorithms({
        algorithm: { forwarder: "an invalid forwarder" as any },
      });

      expect(result).toEqual([]);
    });

    it("panics when neither an algorithm nor a category is specified", () => {
      const provider = new GeneratorMetadataProvider(SystemProvider, ApplicationProvider, []);

      // `any` cast required because this test subverts the type system
      expect(() => provider.algorithms({} as any)).toThrow("algorithm or type required");
    });
  });

  describe("algorithms$", () => {
    it.each([
      [Algorithm.catchall, catchall],
      [Algorithm.username, effWordList],
      [Algorithm.password, password],
    ])("gets a specific algorithm", async (algorithm, metadata) => {
      SomePolicyService.policiesByType$.mockReturnValue(new BehaviorSubject([]));
      const provider = new GeneratorMetadataProvider(SystemProvider, ApplicationProvider, [
        metadata,
      ]);
      const result = new ReplaySubject<CredentialAlgorithm[]>(1);

      provider.algorithms$({ algorithm }, { account$: SomeAccount$ }).subscribe(result);

      await expect(firstValueFrom(result)).resolves.toEqual([algorithm]);
    });

    it.each([
      [Type.email, [catchall, plusAddress]],
      [Type.username, [effWordList]],
      [Type.password, [password, passphrase]],
    ])("gets a category of algorithms", async (category, metadata) => {
      SomePolicyService.policiesByType$.mockReturnValue(new BehaviorSubject([]));
      const provider = new GeneratorMetadataProvider(SystemProvider, ApplicationProvider, metadata);
      const result = new ReplaySubject<CredentialAlgorithm[]>(1);

      provider.algorithms$({ type: category }, { account$: SomeAccount$ }).subscribe(result);

      const expectedAlgorithms = expect.arrayContaining(metadata.map((m) => m.id));
      await expect(firstValueFrom(result)).resolves.toEqual(expectedAlgorithms);
    });

    it("omits algorithms blocked by policy", async () => {
      const policy = new Policy({
        type: PolicyType.PasswordGenerator,
        enabled: true,
        data: {
          overridePasswordType: Algorithm.password,
        },
      } as any);
      SomePolicyService.policiesByType$.mockReturnValue(new BehaviorSubject([policy]));
      const metadata = [password, passphrase];
      const provider = new GeneratorMetadataProvider(SystemProvider, ApplicationProvider, metadata);
      const algorithmResult = new ReplaySubject<CredentialAlgorithm[]>(1);
      const categoryResult = new ReplaySubject<CredentialAlgorithm[]>(1);

      provider
        .algorithms$({ algorithm: Algorithm.passphrase }, { account$: SomeAccount$ })
        .subscribe(algorithmResult);
      provider
        .algorithms$({ type: Type.password }, { account$: SomeAccount$ })
        .subscribe(categoryResult);

      await expect(firstValueFrom(algorithmResult)).resolves.toEqual([]);
      await expect(firstValueFrom(categoryResult)).resolves.toEqual([password.id]);
    });

    it("omits algorithms whose metadata is unavailable", async () => {
      SomePolicyService.policiesByType$.mockReturnValue(new BehaviorSubject([]));
      const provider = new GeneratorMetadataProvider(SystemProvider, ApplicationProvider, [
        password,
      ]);
      const algorithmResult = new ReplaySubject<CredentialAlgorithm[]>(1);
      const categoryResult = new ReplaySubject<CredentialAlgorithm[]>(1);

      provider
        .algorithms$({ algorithm: Algorithm.passphrase }, { account$: SomeAccount$ })
        .subscribe(algorithmResult);
      provider
        .algorithms$({ type: Type.password }, { account$: SomeAccount$ })
        .subscribe(categoryResult);

      await expect(firstValueFrom(algorithmResult)).resolves.toEqual([]);
      await expect(firstValueFrom(categoryResult)).resolves.toEqual([password.id]);
    });

    it("panics when neither algorithm nor category are specified", () => {
      const provider = new GeneratorMetadataProvider(SystemProvider, ApplicationProvider, []);

      expect(() => provider.algorithms$({} as any, { account$: SomeAccount$ })).toThrow(
        "algorithm or type required",
      );
    });
  });

  describe("preference$", () => {
    const preferences: CredentialPreference = deepFreeze({
      [Type.email]: { algorithm: Algorithm.catchall, updated: new Date() },
      [Type.username]: { algorithm: Algorithm.username, updated: new Date() },
      [Type.password]: { algorithm: Algorithm.password, updated: new Date() },
    });
    beforeEach(async () => {
      await SomeStateProvider.setUserState(PREFERENCES, preferences, SomeAccount.id);
    });

    it.each([
      [Type.email, catchall],
      [Type.username, effWordList],
      [Type.password, password],
    ])("emits the user's %s preference", async (type, metadata) => {
      SomePolicyService.policiesByType$.mockReturnValue(new BehaviorSubject([]));
      const provider = new GeneratorMetadataProvider(SystemProvider, ApplicationProvider, [
        metadata,
      ]);
      const result = new ReplaySubject<CredentialAlgorithm | undefined>(1);

      provider.preference$(type, { account$: SomeAccount$ }).subscribe(result);

      await expect(firstValueFrom(result)).resolves.toEqual(preferences[type].algorithm);
    });

    it("emits a default when the user's preference is unavailable", async () => {
      SomePolicyService.policiesByType$.mockReturnValue(new BehaviorSubject([]));
      const provider = new GeneratorMetadataProvider(SystemProvider, ApplicationProvider, [
        plusAddress,
      ]);
      const result = new ReplaySubject<CredentialAlgorithm | undefined>(1);

      // precondition: the preferred email is excluded from the provided metadata
      expect(preferences.email.algorithm).not.toEqual(plusAddress.id);

      provider.preference$(Type.email, { account$: SomeAccount$ }).subscribe(result);

      await expect(firstValueFrom(result)).resolves.toEqual(plusAddress.id);
    });

    it("emits the original preference when the user's preference is unavailable and there is no metadata", async () => {
      SomePolicyService.policiesByType$.mockReturnValue(new BehaviorSubject([]));
      const provider = new GeneratorMetadataProvider(SystemProvider, ApplicationProvider, []);
      const result = new ReplaySubject<CredentialAlgorithm | undefined>(1);

      provider.preference$(Type.email, { account$: SomeAccount$ }).subscribe(result);

      await expect(firstValueFrom(result)).resolves.toEqual(preferences[Type.email].algorithm);
    });
  });

  describe("preferences", () => {
    it("returns a user state subject", () => {
      const provider = new GeneratorMetadataProvider(SystemProvider, ApplicationProvider, []);

      const subject = provider.preferences({ account$: SomeAccount$ });

      expect(subject).toBeInstanceOf(UserStateSubject);
    });
  });
});
