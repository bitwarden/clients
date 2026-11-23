import {
  AccessPolicyService,
  AccessService,
  CountService,
  ProjectService,
  SecretService,
  SecretsManagerPortingApiService,
  SecretVersionService,
  ServiceAccountEventLogApiService,
  ServiceAccountService,
} from "@bitwarden/bit-sm";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncryptService, KeyGenerationService } from "@bitwarden/legacy-crypto";
import { SafeProvider, safeProvider } from "@bitwarden/ui-common";

/**
 * Secrets Manager root-level providers, so web components, guards, and dialogs share a
 * single instance of each service.
 */
export function provideSecretsManager(): SafeProvider[] {
  return [
    safeProvider({
      provide: AccessPolicyService,
      deps: [KeyService, ApiService, EncryptService, AccountService, LogService],
    }),
    safeProvider({
      provide: ProjectService,
      deps: [KeyService, ApiService, EncryptService, AccountService],
    }),
    safeProvider({
      provide: SecretService,
      deps: [KeyService, ApiService, EncryptService, AccessPolicyService, AccountService],
    }),
    safeProvider({
      provide: SecretVersionService,
      deps: [KeyService, ApiService, EncryptService, AccountService],
    }),
    safeProvider({
      provide: ServiceAccountService,
      deps: [KeyService, ApiService, EncryptService, AccountService, LogService],
    }),
    safeProvider({
      provide: AccessService,
      deps: [
        KeyService,
        ApiService,
        KeyGenerationService,
        EncryptService,
        AccountService,
        LogService,
      ],
    }),
    safeProvider({
      provide: ServiceAccountEventLogApiService,
      deps: [ApiService],
    }),
    safeProvider({
      provide: CountService,
      deps: [ApiService],
    }),
    safeProvider({
      provide: SecretsManagerPortingApiService,
      deps: [ApiService, EncryptService, KeyService, AccountService],
    }),
  ];
}
