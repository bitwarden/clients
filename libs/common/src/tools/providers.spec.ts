import { mock, MockProxy } from "jest-mock-extended";

import { PolicyService } from "../admin-console/abstractions/policy/policy.service.abstraction";
import { ConfigService } from "../platform/abstractions/config/config.service";
import { LogService } from "../platform/abstractions/log.service";
import { PlatformUtilsService } from "../platform/abstractions/platform-utils.service";
import { StateProvider } from "../platform/state";

import { LegacyEncryptorProvider } from "./cryptography/legacy-encryptor-provider";
import { ExtensionRegistry } from "./extension/extension-registry.abstraction";
import { ExtensionService } from "./extension/extension.service";
import { disabledSemanticLoggerProvider } from "./log";
import { createSystemServiceProvider } from "./providers";

describe("SystemServiceProvider", () => {
  let mockEncryptor: LegacyEncryptorProvider;
  let mockState: StateProvider;
  let mockPolicy: PolicyService;
  let mockRegistry: ExtensionRegistry;
  let mockLogger: LogService;
  let mockEnvironment: MockProxy<PlatformUtilsService>;
  let mockConfigService: ConfigService;

  beforeEach(() => {
    jest.resetAllMocks();

    mockEncryptor = mock<LegacyEncryptorProvider>();
    mockState = mock<StateProvider>();
    mockPolicy = mock<PolicyService>();
    mockRegistry = mock<ExtensionRegistry>();
    mockLogger = mock<LogService>();
    mockEnvironment = mock<PlatformUtilsService>();
    mockConfigService = mock<ConfigService>();
  });

  describe("createSystemServiceProvider", () => {
    it("returns object with all required services when called with valid parameters", () => {
      mockEnvironment.isDev.mockReturnValue(false);

      const result = createSystemServiceProvider(
        mockEncryptor,
        mockState,
        mockPolicy,
        mockRegistry,
        mockLogger,
        mockEnvironment,
        mockConfigService,
      );

      expect(result).toHaveProperty("policy", mockPolicy);
      expect(result).toHaveProperty("extension");
      expect(result).toHaveProperty("log");
      expect(result).toHaveProperty("configService", mockConfigService);
      expect(result).toHaveProperty("environment", mockEnvironment);
      expect(result.extension).toBeInstanceOf(ExtensionService);
    });

    it("creates ExtensionService with correct dependencies when called", () => {
      mockEnvironment.isDev.mockReturnValue(true);

      const result = createSystemServiceProvider(
        mockEncryptor,
        mockState,
        mockPolicy,
        mockRegistry,
        mockLogger,
        mockEnvironment,
        mockConfigService,
      );

      expect(result.extension).toBeInstanceOf(ExtensionService);
    });

    describe("given development environment", () => {
      it("uses enableLogForTypes when environment.isDev() returns true", () => {
        mockEnvironment.isDev.mockReturnValue(true);

        const result = createSystemServiceProvider(
          mockEncryptor,
          mockState,
          mockPolicy,
          mockRegistry,
          mockLogger,
          mockEnvironment,
          mockConfigService,
        );

        expect(mockEnvironment.isDev).toHaveBeenCalledTimes(1);
        expect(result.log).not.toBe(disabledSemanticLoggerProvider);
      });
    });

    describe("given production environment", () => {
      it("uses disabledSemanticLoggerProvider when environment.isDev() returns false", () => {
        mockEnvironment.isDev.mockReturnValue(false);

        const result = createSystemServiceProvider(
          mockEncryptor,
          mockState,
          mockPolicy,
          mockRegistry,
          mockLogger,
          mockEnvironment,
          mockConfigService,
        );

        expect(mockEnvironment.isDev).toHaveBeenCalledTimes(1);
        expect(result.log).toBe(disabledSemanticLoggerProvider);
      });
    });

    it("configures ExtensionService with encryptor, state, log provider, and now function when called", () => {
      mockEnvironment.isDev.mockReturnValue(false);
      const dateSpy = jest.spyOn(Date, "now");

      const result = createSystemServiceProvider(
        mockEncryptor,
        mockState,
        mockPolicy,
        mockRegistry,
        mockLogger,
        mockEnvironment,
        mockConfigService,
      );

      expect(result.extension).toBeInstanceOf(ExtensionService);
      expect(dateSpy).not.toHaveBeenCalled();
    });

    it("passes through policy service correctly when called", () => {
      mockEnvironment.isDev.mockReturnValue(false);

      const result = createSystemServiceProvider(
        mockEncryptor,
        mockState,
        mockPolicy,
        mockRegistry,
        mockLogger,
        mockEnvironment,
        mockConfigService,
      );

      expect(result.policy).toBe(mockPolicy);
    });

    it("passes through configService correctly when called", () => {
      mockEnvironment.isDev.mockReturnValue(false);

      const result = createSystemServiceProvider(
        mockEncryptor,
        mockState,
        mockPolicy,
        mockRegistry,
        mockLogger,
        mockEnvironment,
        mockConfigService,
      );

      expect(result.configService).toBe(mockConfigService);
    });

    it("passes through environment service correctly when called", () => {
      mockEnvironment.isDev.mockReturnValue(false);

      const result = createSystemServiceProvider(
        mockEncryptor,
        mockState,
        mockPolicy,
        mockRegistry,
        mockLogger,
        mockEnvironment,
        mockConfigService,
      );

      expect(result.environment).toBe(mockEnvironment);
    });
  });
});
