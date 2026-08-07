import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { SafeProvider, safeProvider } from "@bitwarden/ui-common";
import { VAULT_ROW_LEASE_BADGE } from "@bitwarden/web-vault/app/vault/components/vault-items/vault-row-lease-badge.token";

import { CidrValidationService } from "./access-rules/access-rule-edit/ip-allowlist/cidr-validation.service";
import { DefaultCidrValidationService } from "./access-rules/access-rule-edit/ip-allowlist/default-cidr-validation.service";
import { AccessLeasesSdkService } from "./services/access-leases-sdk.service";
import { AccessRequestsSdkService } from "./services/access-requests-sdk.service";
import { AccessRulesSdkService } from "./services/access-rules-sdk.service";
import { DefaultLeasingErrorService } from "./services/default-leasing-error.service";
import { VaultRowLeaseBadgeComponent } from "./vault-row-lease-badge/vault-row-lease-badge.component";

import {
  AccessLeaseSdkService,
  AccessRequestSdkService,
  AccessRuleSdkService,
  LeasingErrorService,
} from ".";

/**
 * PAM-owned root-level providers. Consumed by the commercial web `AppModule` so
 * the shell imports a single function instead of enumerating each PAM provider
 * inline. Binds `AccessRuleSdkService` (the abstract CRUD contract from
 * `.`) to `AccessRulesSdkService`, which serves access-rule
 * CRUD via the Rust SDK's `commercial().pam().access_rules()` client,
 * `AccessRequestSdkService` to `AccessRequestsSdkService` and
 * `AccessLeaseSdkService` to `AccessLeasesSdkService` (the "My access"
 * request/lease lifecycle, both served via the Rust SDK's
 * `commercial().pam().access_requests()`/`leases()` clients), and
 * `CidrValidationService` to its SDK-backed default for the IP-allowlist editor.
 */
export function providePam(): SafeProvider[] {
  return [
    safeProvider({
      provide: AccessRuleSdkService,
      useClass: AccessRulesSdkService,
      deps: [SdkService, AccountService, LogService],
    }),
    safeProvider({
      provide: AccessRequestSdkService,
      useClass: AccessRequestsSdkService,
      deps: [SdkService, AccountService, LogService],
    }),
    safeProvider({
      provide: AccessLeaseSdkService,
      useClass: AccessLeasesSdkService,
      deps: [SdkService, AccountService, LogService],
    }),
    safeProvider({
      provide: LeasingErrorService,
      useClass: DefaultLeasingErrorService,
      deps: [],
    }),
    safeProvider({
      provide: CidrValidationService,
      useClass: DefaultCidrValidationService,
      deps: [],
    }),
    safeProvider({
      provide: VAULT_ROW_LEASE_BADGE,
      useValue: VaultRowLeaseBadgeComponent,
    }),
  ];
}
