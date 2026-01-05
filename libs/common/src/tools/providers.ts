import { LogService } from "@bitwarden/logging";
import { BitwardenClient } from "@bitwarden/sdk-internal";
import { StateProvider } from "@bitwarden/state";

import { PolicyService } from "../admin-console/abstractions/policy/policy.service.abstraction";
import { ConfigService } from "../platform/abstractions/config/config.service";
import { PlatformUtilsService } from "../platform/abstractions/platform-utils.service";

import { LegacyEncryptorProvider } from "./cryptography/legacy-encryptor-provider";
import { ExtensionRegistry } from "./extension/extension-registry.abstraction";
import { ExtensionService } from "./extension/extension.service";
import { disabledSemanticLoggerProvider, enableLogForTypes, LogProvider } from "./log";

/** Provides access to commonly-used cross-cutting services. */
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

/** Constructs a system service provider. */
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
