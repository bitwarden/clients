import { NgModule } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { safeProvider } from "@bitwarden/angular/platform/utils/safe-provider";
import { SafeInjectionToken } from "@bitwarden/angular/services/injection-tokens";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { KeyServiceLegacyEncryptorProvider } from "@bitwarden/common/tools/cryptography/key-service-legacy-encryptor-provider";
import { LegacyEncryptorProvider } from "@bitwarden/common/tools/cryptography/legacy-encryptor-provider";
import {
  createRandomizer,
  CredentialGeneratorService,
  Randomizer,
} from "@bitwarden/generator-core";
import { KeyService } from "@bitwarden/key-management";

export const RANDOMIZER = new SafeInjectionToken<Randomizer>("Randomizer");

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
      provide: CredentialGeneratorService,
      useClass: CredentialGeneratorService,
      deps: [
        RANDOMIZER,
        StateProvider,
        PolicyService,
        ApiService,
        I18nService,
        LegacyEncryptorProvider,
        AccountService,
      ],
    }),
  ],
})
export class GeneratorServicesModule {
  constructor() {}
}
