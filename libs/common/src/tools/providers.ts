import { SemVer } from "semver";

import {
  disabledSemanticLoggerProvider,
  enableLogForTypes,
  LogProvider,
  LogService,
} from "@bitwarden/logging";
import { BitwardenClient } from "@bitwarden/sdk-internal";
import { StateProvider } from "@bitwarden/state";

import { PolicyService } from "../admin-console/abstractions/policy/policy.service.abstraction";
import { FeatureFlag } from "../enums/feature-flag.enum";
import { ConfigService } from "../platform/abstractions/config/config.service";
import { PlatformUtilsService } from "../platform/abstractions/platform-utils.service";
import { UserId } from "../types/guid";

import { EnvService } from "./abstractions/env.service";
import { LegacyEncryptorProvider } from "./cryptography/legacy-encryptor-provider";
import { ExtensionRegistry } from "./extension/extension-registry.abstraction";
import { ExtensionService } from "./extension/extension.service";

export { EnvService } from "./abstractions/env.service";

/**
 * @deprecated Use individual service injection instead: PolicyService, ExtensionService,
 * LogProvider, and EnvService (which consolidates ConfigService and PlatformUtilsService).
 *
 * Provides access to commonly-used cross-cutting services.
 */
export type SystemServiceProvider = {
  /** Policy configured by the administrative console */
  readonly policy: PolicyService;

  /** Client extension metadata and profile access */
  readonly extension: ExtensionService;

  /** Event monitoring and diagnostic interfaces */
  readonly log: LogProvider;

  /** Config Service to determine flag features */
  readonly configService: ConfigService;

  /** Platform Service to inspect runtime environment */
  readonly environment: PlatformUtilsService;

  /** SDK Service */
  readonly sdk?: BitwardenClient;
};

/**
 * @deprecated Use individual service injection instead.
 *
 * Constructs a system service provider.
 */
export function createSystemServiceProvider(
  encryptor: LegacyEncryptorProvider,
  state: StateProvider,
  policy: PolicyService,
  registry: ExtensionRegistry,
  logger: LogService,
  environment: PlatformUtilsService,
  configService: ConfigService,
): SystemServiceProvider {
  let log: LogProvider;
  if (environment.isDev()) {
    log = enableLogForTypes(logger, []);
  } else {
    log = disabledSemanticLoggerProvider;
  }

  const extension = new ExtensionService(registry, {
    encryptor,
    state,
    log,
    now: Date.now,
  });

  return {
    policy,
    extension,
    log,
    configService,
    environment,
  };
}

/**
 * Facade exposing methods from ConfigService and PlatformUtilsService that are related to environmental awareness
 */
export class DefaultEnvService extends EnvService {
  constructor(
    private configService: ConfigService,
    private platformUtilsService: PlatformUtilsService,
  ) {
    super();
  }

  /* ConfigService methods */
  get serverConfig$() {
    return this.configService.serverConfig$;
  }

  get serverSettings$() {
    return this.configService.serverSettings$;
  }

  get cloudRegion$() {
    return this.configService.cloudRegion$;
  }

  getFeatureFlag$<Flag extends FeatureFlag>(key: Flag) {
    return this.configService.getFeatureFlag$(key);
  }

  userCachedFeatureFlag$<Flag extends FeatureFlag>(key: Flag, userId: UserId) {
    return this.configService.userCachedFeatureFlag$(key, userId);
  }

  getFeatureFlag<Flag extends FeatureFlag>(key: Flag) {
    return this.configService.getFeatureFlag(key);
  }

  checkServerMeetsVersionRequirement$(minimumRequiredServerVersion: SemVer) {
    return this.configService.checkServerMeetsVersionRequirement$(minimumRequiredServerVersion);
  }

  ensureConfigFetched() {
    return this.configService.ensureConfigFetched();
  }

  /* PlatformUtilsService methods */
  getDevice() {
    return this.platformUtilsService.getDevice();
  }

  getDeviceString() {
    return this.platformUtilsService.getDeviceString();
  }

  getClientType() {
    return this.platformUtilsService.getClientType();
  }

  isFirefox() {
    return this.platformUtilsService.isFirefox();
  }

  isChrome() {
    return this.platformUtilsService.isChrome();
  }

  isEdge() {
    return this.platformUtilsService.isEdge();
  }

  isOpera() {
    return this.platformUtilsService.isOpera();
  }

  isVivaldi() {
    return this.platformUtilsService.isVivaldi();
  }

  isSafari() {
    return this.platformUtilsService.isSafari();
  }

  isChromium() {
    return this.platformUtilsService.isChromium();
  }

  isMacAppStore() {
    return this.platformUtilsService.isMacAppStore();
  }

  isPopupOpen() {
    return this.platformUtilsService.isPopupOpen();
  }

  launchUri(uri: string, options?: any) {
    return this.platformUtilsService.launchUri(uri, options);
  }

  getApplicationVersion() {
    return this.platformUtilsService.getApplicationVersion();
  }

  getApplicationVersionNumber() {
    return this.platformUtilsService.getApplicationVersionNumber();
  }

  supportsWebAuthn(win: Window) {
    return this.platformUtilsService.supportsWebAuthn(win);
  }

  supportsDuo() {
    return this.platformUtilsService.supportsDuo();
  }

  supportsAutofill() {
    return this.platformUtilsService.supportsAutofill();
  }

  supportsFileDownloads() {
    return this.platformUtilsService.supportsFileDownloads();
  }

  isDev() {
    return this.platformUtilsService.isDev();
  }

  isSelfHost() {
    return this.platformUtilsService.isSelfHost();
  }

  copyToClipboard(text: string, options?: any) {
    return this.platformUtilsService.copyToClipboard(text, options);
  }

  readFromClipboard() {
    return this.platformUtilsService.readFromClipboard();
  }

  supportsSecureStorage() {
    return this.platformUtilsService.supportsSecureStorage();
  }

  getAutofillKeyboardShortcut() {
    return this.platformUtilsService.getAutofillKeyboardShortcut();
  }

  /**
   * @deprecated use `@bitwarden/components/ToastService.showToast` instead
   */
  showToast(
    type: "error" | "success" | "warning" | "info",
    title: string,
    text: string | string[],
    options?: any,
  ) {
    return this.platformUtilsService.showToast(type, title, text, options);
  }
}
