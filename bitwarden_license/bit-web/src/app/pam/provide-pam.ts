import { AccessEventService, GovernanceService, PamApiService } from "@bitwarden/bit-pam";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { SafeProvider, safeProvider } from "@bitwarden/ui-common";
import { CIPHER_VIEW_BANNER, GATED_CIPHER_RELOADER } from "@bitwarden/vault";
import { COLLECTION_ACCESS_RULE_CALLOUT } from "@bitwarden/web-vault/app/admin-console/organizations/shared/components/collection-dialog/collection-access-rule-callout.token";
import { PamInboxBadgeService } from "@bitwarden/web-vault/app/pam/pam-inbox-badge.service";
import { VAULT_ROW_LEASE_BADGE } from "@bitwarden/web-vault/app/vault/components/vault-items/vault-row-lease-badge.token";
import { CIPHER_OPEN_GATE } from "@bitwarden/web-vault/app/vault/individual-vault/cipher-open-gate";

import { ApproverInboxRequestsService } from "./approver-inbox/approver-inbox-requests.service";
import { CipherLeaseBannerComponent } from "./cipher-lease-banner/cipher-lease-banner.component";
import { PamCipherOpenGate } from "./cipher-open-gate.service";
import { CollectionAccessRuleCalloutComponent } from "./collection-access-rule-callout/collection-access-rule-callout.component";
import { PamGatedCipherReloader } from "./gated-cipher-reloader.service";
// DEMO ONLY: governance has no backend yet, so it is always mocked (see provider TODO).
import { MockGovernanceService } from "./mock/mock-governance.service";
import { DefaultAccessEventService } from "./services/default-access-event.service";
import { DefaultPamApiService } from "./services/default-pam-api.service";
import { LeasedCipherFetcherService } from "./services/leased-cipher-fetcher.service";
import { VaultRowLeaseBadgeComponent } from "./vault-row-lease-badge/vault-row-lease-badge.component";

/**
 * PAM-owned root-level providers. Consumed by the commercial web `AppModule` so
 * the shell imports a single function instead of enumerating each PAM provider
 * inline. Binds the OSS-defined abstractions/tokens (`PamApiService`,
 * `AccessEventService`, `PamInboxBadgeService`, the vault seam tokens, and the
 * collection-callout / vault-row-badge component tokens) to their commercial
 * implementations.
 *
 * The governance dashboard + kill switch (`GovernanceService`) have no backend
 * yet, so they are bound to `MockGovernanceService` unconditionally — swap in a
 * real implementation once the server lands (see the provider TODO). Every other
 * PAM call (`PamApiService`) always hits the real server.
 */
export function providePam(): SafeProvider[] {
  return [
    safeProvider({
      provide: PamApiService,
      useFactory: (apiService: ApiService, accessEvents: AccessEventService) =>
        new DefaultPamApiService(apiService, accessEvents),
      deps: [ApiService, AccessEventService],
    }),
    safeProvider({
      provide: GovernanceService,
      // TODO: Replace with real GovernanceService when backend is implemented.
      useClass: MockGovernanceService,
      deps: [],
    }),
    safeProvider({
      provide: AccessEventService,
      useFactory: (notificationsService: ServerNotificationsService) =>
        new DefaultAccessEventService(notificationsService.notifications$),
      deps: [ServerNotificationsService],
    }),
    safeProvider({
      provide: CIPHER_OPEN_GATE,
      useExisting: PamCipherOpenGate,
      deps: [],
    }),
    safeProvider({
      provide: CIPHER_VIEW_BANNER,
      useValue: CipherLeaseBannerComponent,
    }),
    safeProvider({
      provide: GATED_CIPHER_RELOADER,
      useExisting: PamGatedCipherReloader,
      deps: [],
    }),
    safeProvider({
      provide: LeasedCipherFetcherService,
      useFactory: (pamApiService: PamApiService) => new LeasedCipherFetcherService(pamApiService),
      deps: [PamApiService],
    }),
    safeProvider({
      provide: PamInboxBadgeService,
      useExisting: ApproverInboxRequestsService,
      deps: [],
    }),
    safeProvider({
      provide: COLLECTION_ACCESS_RULE_CALLOUT,
      useValue: CollectionAccessRuleCalloutComponent,
    }),
    safeProvider({
      provide: VAULT_ROW_LEASE_BADGE,
      useValue: VaultRowLeaseBadgeComponent,
    }),
  ];
}
