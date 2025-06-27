import { BehaviorSubject, Subject, firstValueFrom, of } from "rxjs";

import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import { Site, VendorId } from "@bitwarden/common/tools/extension";
import { Bitwarden } from "@bitwarden/common/tools/extension/vendor/bitwarden";
import { Vendor } from "@bitwarden/common/tools/extension/vendor/data";
import { SemanticLogger, ifEnabledSemanticLoggerProvider } from "@bitwarden/common/tools/log";
import { UserId } from "@bitwarden/common/types/guid";

import { awaitAsync } from "../../../../../common/spec";
import {
  Algorithm,
  CredentialAlgorithm,
  CredentialType,
  ForwarderExtensionId,
  GeneratorMetadata,
  Profile,
  Type,
} from "../metadata";
import { CredentialGeneratorProviders } from "../providers";
import { GenerateRequest, GeneratedCredential } from "../types";

import { DefaultCredentialGeneratorService } from "./default-credential-generator.service";

// Custom type for jest.fn() mocks to preserve their type
type JestMockFunction<T extends (...args: any) => any> = jest.Mock<ReturnType<T>, Parameters<T>>;

// two-level partial that preserves jest.fn() mock types
type MockTwoLevelPartial<T> = {
  [K in keyof T]?: T[K] extends object
    ? {
        [P in keyof T[K]]?: T[K][P] extends (...args: any) => any
          ? JestMockFunction<T[K][P]>
          : T[K][P];
      }
    : T[K];
};

describe("DefaultCredentialGeneratorService", () => {
  let service: DefaultCredentialGeneratorService;
  let providers: MockTwoLevelPartial<CredentialGeneratorProviders>;
  let system: any;
  let log: SemanticLogger;
  let mockExtension: { settings: jest.Mock };
  let account: Account;
  let createService: (overrides?: any) => DefaultCredentialGeneratorService;

  beforeEach(() => {
    log = ifEnabledSemanticLoggerProvider(false, new ConsoleLogService(true), {
      from: "DefaultCredentialGeneratorService tests",
    });

    mockExtension = { settings: jest.fn() };

    // Use a hard-coded value for mockAccount
    account = {
      id: "test-account-id" as UserId,
      emailVerified: true,
      email: "test@example.com",
      name: "Test User",
    };

    system = {
      log: jest.fn().mockReturnValue(log),
      extension: mockExtension,
    };

    providers = {
      metadata: {
        metadata: jest.fn(),
        preference$: jest.fn(),
        algorithms$: jest.fn(),
        algorithms: jest.fn(),
        preferences: jest.fn(),
      },
      profile: {
        settings: jest.fn(),
        constraints$: jest.fn(),
      },
      generator: {},
    };

    // Creating the service instance with a cast to the expected type
    createService = (overrides = {}) => {
      // Force cast the incomplete providers to the required type
      // similar to how the overrides are applied
      const providersCast = providers as unknown as CredentialGeneratorProviders;

      const instance = new DefaultCredentialGeneratorService(providersCast, system);
      Object.assign(instance, overrides);
      return instance;
    };

    service = createService();
  });

  describe("generate$", () => {
    it("should generate credentials when provided a specific algorithm", async () => {
      const mockEngine = {
        generate: jest
          .fn()
          .mockReturnValue(
            of(
              new GeneratedCredential("generatedPassword", Type.password, Date.now(), "unit test"),
            ),
          ),
      };
      const mockMetadata = {
        id: Algorithm.password,
        engine: { create: jest.fn().mockReturnValue(mockEngine) },
      } as unknown as GeneratorMetadata<any>;
      const mockSettings = new BehaviorSubject({ length: 12 });
      providers.metadata!.metadata = jest.fn().mockReturnValue(mockMetadata);
      service = createService({
        settings: () => mockSettings as any,
      });
      const on$ = new Subject<GenerateRequest>();
      const account$ = new BehaviorSubject(account);
      const result$ = new BehaviorSubject<GeneratedCredential | null>(null);

      service.generate$({ on$, account$ }).subscribe(result$);
      on$.next({ algorithm: Algorithm.password });
      await awaitAsync();

      expect(result$.value?.credential).toEqual("generatedPassword");
      expect(providers.metadata!.metadata).toHaveBeenCalledWith(Algorithm.password);
      expect(mockMetadata.engine.create).toHaveBeenCalled();
      expect(mockEngine.generate).toHaveBeenCalled();
    });

    it("should determine preferred algorithm from credential type and generate credentials", async () => {
      const mockEngine = {
        generate: jest
          .fn()
          .mockReturnValue(
            of(new GeneratedCredential("generatedPassword", "password", Date.now(), "unit test")),
          ),
      };
      const mockMetadata = {
        id: "testAlgorithm",
        engine: { create: jest.fn().mockReturnValue(mockEngine) },
      } as unknown as GeneratorMetadata<any>;
      const mockSettings = new BehaviorSubject({ length: 12 });

      providers.metadata!.preference$ = jest
        .fn()
        .mockReturnValue(of("testAlgorithm" as CredentialAlgorithm));
      providers.metadata!.metadata = jest.fn().mockReturnValue(mockMetadata);
      service = createService({
        settings: () => mockSettings as any,
      });

      const on$ = new Subject<GenerateRequest>();
      const account$ = new BehaviorSubject(account);
      const result$ = new BehaviorSubject<GeneratedCredential | null>(null);

      service.generate$({ on$, account$ }).subscribe(result$);
      on$.next({ type: Type.password });
      await awaitAsync();

      expect(result$.value?.credential).toBe("generatedPassword");
      expect(result$.value?.category).toBe(Type.password);
      expect(providers.metadata!.metadata).toHaveBeenCalledWith("testAlgorithm");
    });
  });

  describe("algorithms$", () => {
    it("should retrieve and map available algorithms for a credential type", async () => {
      const mockAlgorithms = [Algorithm.password, Algorithm.passphrase] as CredentialAlgorithm[];
      const mockMetadata1 = { id: Algorithm.password } as GeneratorMetadata<any>;
      const mockMetadata2 = { id: Algorithm.passphrase } as GeneratorMetadata<any>;

      providers.metadata!.algorithms$ = jest.fn().mockReturnValue(of(mockAlgorithms));
      providers.metadata!.metadata = jest
        .fn()
        .mockReturnValueOnce(mockMetadata1)
        .mockReturnValueOnce(mockMetadata2);

      const result = await firstValueFrom(
        service.algorithms$("password" as CredentialType, { account$: of(account) }),
      );

      expect(result).toEqual([mockMetadata1, mockMetadata2]);
    });
  });

  describe("algorithms", () => {
    it("should list algorithm metadata for a single credential type", () => {
      providers.metadata!.algorithms = jest
        .fn()
        .mockReturnValue([Algorithm.password, Algorithm.passphrase] as CredentialAlgorithm[]);
      service = createService({
        algorithm: (id: CredentialAlgorithm) => ({ id }) as GeneratorMetadata<any>,
      });

      const result = service.algorithms("password" as CredentialType);

      expect(result).toEqual([{ id: Algorithm.password }, { id: Algorithm.passphrase }]);
      expect(providers.metadata!.algorithms).toHaveBeenCalledWith({ type: "password" });
    });

    it("should list combined algorithm metadata for multiple credential types", () => {
      providers.metadata!.algorithms = jest
        .fn()
        .mockReturnValueOnce([Algorithm.password] as CredentialAlgorithm[])
        .mockReturnValueOnce([Algorithm.username] as CredentialAlgorithm[]);

      service = createService({
        algorithm: (id: CredentialAlgorithm) => ({ id }) as GeneratorMetadata<any>,
      });

      const result = service.algorithms(["password", "username"] as CredentialType[]);

      expect(result).toEqual([{ id: Algorithm.password }, { id: Algorithm.username }]);
      expect(providers.metadata!.algorithms).toHaveBeenCalledWith({ type: "password" });
      expect(providers.metadata!.algorithms).toHaveBeenCalledWith({ type: "username" });
    });
  });

  describe("algorithm", () => {
    it("should retrieve metadata for a specific generator algorithm", () => {
      const mockMetadata = { id: Algorithm.password } as GeneratorMetadata<any>;
      providers.metadata!.metadata = jest.fn().mockReturnValue(mockMetadata);

      const result = service.algorithm(Algorithm.password);

      expect(result).toBe(mockMetadata);
      expect(providers.metadata!.metadata).toHaveBeenCalledWith(Algorithm.password);
    });

    it("should log a panic when algorithm ID is invalid", () => {
      providers.metadata!.metadata = jest.fn().mockReturnValue(null);

      expect(() => service.algorithm("invalidAlgo" as CredentialAlgorithm)).toThrow(
        "invalid credential algorithm",
      );
    });
  });

  describe("forwarder", () => {
    it("should retrieve forwarder metadata for a specific vendor", () => {
      const vendorId = Vendor.bitwarden;
      const forwarderExtensionId: ForwarderExtensionId = { forwarder: vendorId };
      const mockMetadata = {
        id: forwarderExtensionId,
        type: "email" as CredentialType,
      } as GeneratorMetadata<any>;

      providers.metadata!.metadata = jest.fn().mockReturnValue(mockMetadata);

      const result = service.forwarder(vendorId);

      expect(result).toBe(mockMetadata);
      expect(providers.metadata!.metadata).toHaveBeenCalledWith(forwarderExtensionId);
    });

    it("should log a panic when vendor ID is invalid", () => {
      const invalidVendorId = "invalid-vendor" as VendorId;
      providers.metadata!.metadata = jest.fn().mockReturnValue(null);

      expect(() => service.forwarder(invalidVendorId)).toThrow("invalid vendor");
    });
  });

  describe("preferences", () => {
    it("should retrieve credential preferences bound to the user's account", () => {
      const mockPreferences = { defaultType: "password" };
      providers.metadata!.preferences = jest.fn().mockReturnValue(mockPreferences);

      const result = service.preferences({ account$: of(account) });

      expect(result).toBe(mockPreferences);
    });
  });

  describe("settings", () => {
    it("should load user settings for account-bound profiles", () => {
      const mockSettings = { value: { length: 12 } };
      const mockMetadata = {
        id: "test",
        profiles: {
          [Profile.account]: { id: "accountProfile" },
        },
      } as unknown as GeneratorMetadata<any>;

      providers.profile!.settings = jest.fn().mockReturnValue(mockSettings);

      const result = service.settings(mockMetadata, { account$: of(account) });

      expect(result).toBe(mockSettings);
    });

    it("should load user settings for extension-bound profiles", () => {
      const mockSettings = new BehaviorSubject({ value: { length: 12 } });
      const vendorId = Vendor.bitwarden;
      const forwarderProfile = {
        id: { forwarder: Bitwarden.id },
        site: Site.forwarder,
        type: "extension",
      };
      const mockMetadata = {
        id: { forwarder: vendorId } as ForwarderExtensionId,
        profiles: {
          [Profile.account]: forwarderProfile,
        },
      } as unknown as GeneratorMetadata<any>;

      mockExtension.settings.mockReturnValue(mockSettings);

      const result = service.settings(mockMetadata, { account$: of(account) });

      expect(result).toBe(mockSettings);
    });

    it("should log a panic when profile metadata is not found", () => {
      const mockMetadata = {
        id: "test",
        profiles: {},
      } as unknown as GeneratorMetadata<any>;

      expect(() => service.settings(mockMetadata, { account$: of(account) })).toThrow(
        "failed to load settings; profile metadata not found",
      );
    });
  });

  describe("policy$", () => {
    it("should retrieve policy constraints for a specific profile", async () => {
      const mockConstraints = { minLength: 8 };
      const mockMetadata = {
        id: "test",
        profiles: {
          [Profile.account]: { id: "accountProfile" },
        },
      } as unknown as GeneratorMetadata<any>;

      providers.profile!.constraints$ = jest.fn().mockReturnValue(of(mockConstraints));

      const result = await firstValueFrom(service.policy$(mockMetadata, { account$: of(account) }));

      expect(result).toEqual(mockConstraints);
    });

    it("should log a panic when profile metadata is not found for policy retrieval", () => {
      const mockMetadata = {
        id: "test",
        profiles: {},
      } as unknown as GeneratorMetadata<any>;

      expect(() => service.policy$(mockMetadata, { account$: of(account) })).toThrow(
        "failed to load policy; profile metadata not found",
      );
    });
  });
});
