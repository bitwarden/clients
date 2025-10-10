import { NgModule } from "@angular/core";
import { from } from "rxjs";
import { take } from "rxjs/operators";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { safeProvider } from "@bitwarden/angular/platform/utils/safe-provider";
import { LOG_PROVIDER, SafeInjectionToken } from "@bitwarden/angular/services/injection-tokens";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
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
import { DefaultEnvService, EnvService } from "@bitwarden/common/tools/providers";
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
import { disabledSemanticLoggerProvider, enableLogForTypes, LogProvider } from "@bitwarden/logging";

export const RANDOMIZER = new SafeInjectionToken<Randomizer>("Randomizer");
const GENERATOR_SERVICE_PROVIDER = new SafeInjectionToken<providers.CredentialGeneratorProviders>(
  "CredentialGeneratorProviders",
);

/** Shared module containing generator component dependencies */
@NgModule({
  imports: [JslibModule],
  providers: [
    safeProvider({
      provide: EnvService,
      useClass: DefaultEnvService,
      deps: [ConfigService, PlatformUtilsService],
    }),
    safeProvider({
      provide: LOG_PROVIDER,
      useFactory: (logger: LogService, env: EnvService) => {
        if (env.isDev()) {
          return enableLogForTypes(logger, []);
        } else {
          return disabledSemanticLoggerProvider;
        }
      },
      deps: [LogService, EnvService],
    }),
    safeProvider({
      provide: RANDOMIZER,
      useFactory: createRandomizer,
      deps: [KeyService],
    }),
    safeProvider({
      provide: LegacyEncryptorProvider,
      useClass: KeyServiceLegacyEncryptorProvider,
      deps: [EncryptService, KeyService],
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
      provide: ExtensionService,
      useFactory: (
        registry: ExtensionRegistry,
        encryptor: LegacyEncryptorProvider,
        state: StateProvider,
        log: LogProvider,
      ) => {
        return new ExtensionService(registry, {
          encryptor,
          state,
          log,
          now: Date.now,
        });
      },
      deps: [ExtensionRegistry, LegacyEncryptorProvider, StateProvider, LOG_PROVIDER],
    }),
    safeProvider({
      provide: GENERATOR_SERVICE_PROVIDER,
      useFactory: (
        policy: PolicyService,
        extension: ExtensionService,
        log: LogProvider,
        configService: ConfigService,
        random: Randomizer,
        encryptor: LegacyEncryptorProvider,
        state: StateProvider,
        i18n: I18nService,
        api: ApiService,
      ) => {
        const userStateDeps = {
          encryptor,
          state,
          log,
          now: Date.now,
        } satisfies UserStateSubjectDependencyProvider;

        // Feature flag for SDK password generators (currently not available)
        // TODO: Add SDK service support when available
        const featureFlagObs$ = from(
          configService.getFeatureFlag(FeatureFlag.UseSdkPasswordGenerators),
        );
        let featureFlag: boolean = false;
        featureFlagObs$.pipe(take(1)).subscribe((ff) => (featureFlag = ff));

        const metadata = new providers.GeneratorMetadataProvider(
          userStateDeps,
          policy,
          extension,
          Object.values(BuiltIn),
        );

        const sdkService: undefined = featureFlag ? undefined : undefined;
        const profile = new providers.GeneratorProfileProvider(userStateDeps, policy);

        const generator: providers.GeneratorDependencyProvider = {
          randomizer: random,
          client: new RestClient(api, i18n),
          i18nService: i18n,
          sdk: sdkService,
          now: Date.now,
        };

        const userState: UserStateSubjectDependencyProvider = {
          encryptor,
          state,
          log,
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
        PolicyService,
        ExtensionService,
        LOG_PROVIDER,
        ConfigService,
        RANDOMIZER,
        LegacyEncryptorProvider,
        StateProvider,
        I18nService,
        ApiService,
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
      deps: [GENERATOR_SERVICE_PROVIDER, ExtensionService, LOG_PROVIDER],
    }),
  ],
})
export class GeneratorServicesModule {
  constructor() {}
}
