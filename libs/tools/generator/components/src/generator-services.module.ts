import { NgModule } from "@angular/core";
import { firstValueFrom, shareReplay } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { safeProvider } from "@bitwarden/angular/platform/utils/safe-provider";
import { SafeInjectionToken } from "@bitwarden/angular/services/injection-tokens";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { KeyServiceLegacyEncryptorProvider } from "@bitwarden/common/tools/cryptography/key-service-legacy-encryptor-provider";
import { LegacyEncryptorProvider } from "@bitwarden/common/tools/cryptography/legacy-encryptor-provider";
import { Site } from "@bitwarden/common/tools/extension";
import { ExtensionRegistry } from "@bitwarden/common/tools/extension/extension-registry.abstraction";
import { ExtensionService } from "@bitwarden/common/tools/extension/extension.service";
import { DefaultFields, DefaultSites, Extension } from "@bitwarden/common/tools/extension/metadata";
import { RuntimeExtensionRegistry } from "@bitwarden/common/tools/extension/runtime-extension-registry";
import { VendorExtensions, Vendors } from "@bitwarden/common/tools/extension/vendor";
import { RestClient } from "@bitwarden/common/tools/integration/rpc";
import {
  LogProvider,
  disabledSemanticLoggerProvider,
  enableLogForTypes,
} from "@bitwarden/common/tools/log";
import { SystemServiceProvider } from "@bitwarden/common/tools/providers";
import { UserStateSubjectDependencyProvider } from "@bitwarden/common/tools/state/user-state-subject-dependency-provider";
import {
  BuiltIn,
  createRandomizer,
  CredentialGeneratorService,
  Randomizer,
  providers,
  DefaultCredentialGeneratorService,
} from "@bitwarden/generator-core";
import { KeyService } from "@bitwarden/key-management";

export const RANDOMIZER = new SafeInjectionToken<Randomizer>("Randomizer");
const GENERATOR_SERVICE_PROVIDER = new SafeInjectionToken<providers.CredentialGeneratorProviders>(
  "CredentialGeneratorProviders",
);

// FIXME: relocate the system service provider to a more general module once
//        NX migration is complete.
export const SYSTEM_SERVICE_PROVIDER = new SafeInjectionToken<SystemServiceProvider>(
  "SystemServices",
);

/** Shared module containing generator component dependencies */
@NgModule({
  imports: [JslibModule],
  providers: [
    safeProvider({
      provide: RANDOMIZER,
      useFactory: createRandomizer,
      deps: [],
    }),
    safeProvider({
      provide: LegacyEncryptorProvider,
      useClass: KeyServiceLegacyEncryptorProvider,
      deps: [EncryptService, KeyService, SdkService],
    }),
    safeProvider({
      provide: ExtensionRegistry,
      useFactory: () => {
        const registry = new RuntimeExtensionRegistry(DefaultSites, DefaultFields);

        registry.registerSite(Extension[Site.forwarder]);
        for (const vendor of Vendors) {
          registry.registerVendor(vendor);
        }
        for (const extension of VendorExtensions) {
          registry.registerExtension(extension);
        }
        registry.setPermission({ all: true }, "default");

        return registry;
      },
      deps: [],
    }),
    safeProvider({
      provide: SYSTEM_SERVICE_PROVIDER,
      useFactory: (
        encryptor: LegacyEncryptorProvider,
        state: StateProvider,
        policy: PolicyService,
        registry: ExtensionRegistry,
        logger: LogService,
        environment: PlatformUtilsService,
        configService: ConfigService,
      ) => {
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
        };
      },
      deps: [
        LegacyEncryptorProvider,
        StateProvider,
        PolicyService,
        ExtensionRegistry,
        LogService,
        PlatformUtilsService,
        ConfigService,
      ],
    }),
    safeProvider({
      provide: GENERATOR_SERVICE_PROVIDER,
      useFactory: (
        system: SystemServiceProvider,
        random: Randomizer,
        encryptor: LegacyEncryptorProvider,
        state: StateProvider,
        i18n: I18nService,
        api: ApiService,
        sdkService: SdkService,
      ) => {
        const userStateDeps = {
          encryptor,
          state,
          log: system.log,
          now: Date.now,
        } satisfies UserStateSubjectDependencyProvider;

        const metadata = new providers.GeneratorMetadataProvider(
          userStateDeps,
          system,
          Object.values(BuiltIn),
        );

        const profile = new providers.GeneratorProfileProvider(userStateDeps, system.policy);

        // Hold a single warm subscription to `sdkService.client$` so each
        // generator invocation replays the cached client instead of re-running
        // the inner `concatMap` (which would re-pay `createSdkClient` and
        // `loadFeatureFlags`). `refCount: false` keeps the upstream
        // subscription alive even when no downstream subscribers exist between
        // `firstValueFrom` calls. Environment changes still propagate because
        // the inner `client$` is wired to `environmentService.environment$`.
        // Trade-off: an SDK initialization failure becomes sticky — every
        // subsequent `sdk()` call resolves to the cached error. This matches
        // today's observable behavior (a broken SDK already breaks every
        // downstream consumer).
        const sharedClient$ = sdkService.client$.pipe(
          shareReplay({ refCount: false, bufferSize: 1 }),
        );

        const generator: providers.GeneratorDependencyProvider = {
          randomizer: random,
          client: new RestClient(api, i18n),
          i18nService: i18n,
          sdk: () => firstValueFrom(sharedClient$),
          now: Date.now,
        };

        const userState: UserStateSubjectDependencyProvider = {
          encryptor,
          state,
          log: system.log,
          now: Date.now,
        };

        return {
          userState,
          generator,
          profile,
          metadata,
        } satisfies providers.CredentialGeneratorProviders;
      },
      deps: [
        SYSTEM_SERVICE_PROVIDER,
        RANDOMIZER,
        LegacyEncryptorProvider,
        StateProvider,
        I18nService,
        ApiService,
        SdkService,
      ],
    }),
    safeProvider({
      provide: UserStateSubjectDependencyProvider,
      useFactory: (encryptor: LegacyEncryptorProvider, state: StateProvider) =>
        Object.freeze({
          encryptor,
          state,
          log: disabledSemanticLoggerProvider,
          now: Date.now,
        }),
      deps: [LegacyEncryptorProvider, StateProvider],
    }),
    safeProvider({
      provide: CredentialGeneratorService,
      useClass: DefaultCredentialGeneratorService,
      deps: [GENERATOR_SERVICE_PROVIDER, SYSTEM_SERVICE_PROVIDER],
    }),
  ],
})
export class GeneratorServicesModule {
  constructor() {}
}
