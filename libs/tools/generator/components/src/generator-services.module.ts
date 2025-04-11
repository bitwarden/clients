import { NgModule } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { safeProvider } from "@bitwarden/angular/platform/utils/safe-provider";
import { SafeInjectionToken } from "@bitwarden/angular/services/injection-tokens";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
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
import { disabledSemanticLoggerProvider } from "@bitwarden/common/tools/log";
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
const SYSTEM_SERVICE_PROVIDER = new SafeInjectionToken<SystemServiceProvider>("SystemServices");

/** Shared module containing generator component dependencies */
@NgModule({
  imports: [JslibModule],
  providers: [
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
      provide: SYSTEM_SERVICE_PROVIDER,
      useFactory: (
        encryptor: LegacyEncryptorProvider,
        state: StateProvider,
        policy: PolicyService,
        registry: ExtensionRegistry,
      ) => {
        const log = disabledSemanticLoggerProvider;
        const extension = new ExtensionService(registry, {
          encryptor,
          state,
          log,
        });

        return {
          policy,
          extension,
          log,
        };
      },
      deps: [LegacyEncryptorProvider, StateProvider, PolicyService, ExtensionRegistry],
    }),
    safeProvider({
      provide: GENERATOR_SERVICE_PROVIDER,
      useFactory: (
        system: SystemServiceProvider,
        random: Randomizer,
        encryptor: LegacyEncryptorProvider,
        state: StateProvider,
        rest: RestClient,
        i18n: I18nService,
      ) => {
        const userStateDeps = {
          encryptor,
          state,
          log: system.log,
        } satisfies UserStateSubjectDependencyProvider;

        const metadata = new providers.GeneratorMetadataProvider(
          userStateDeps,
          system,
          Object.values(BuiltIn),
        );
        const profile = new providers.GeneratorProfileProvider(userStateDeps, system.policy);

        const generator: providers.GeneratorDependencyProvider = {
          randomizer: random,
          client: rest,
          i18nService: i18n,
        };

        const userState: UserStateSubjectDependencyProvider = {
          encryptor,
          state,
          log: system.log,
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
        RestClient,
        I18nService,
      ],
    }),
    safeProvider({
      provide: UserStateSubjectDependencyProvider,
      useFactory: (encryptor: LegacyEncryptorProvider, state: StateProvider) =>
        Object.freeze({
          encryptor,
          state,
          log: disabledSemanticLoggerProvider,
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
