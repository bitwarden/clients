import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { AccessEventService, PamApiService, PamInboxBadgeService } from "@bitwarden/pam";
import { SafeProvider, safeProvider } from "@bitwarden/ui-common";
import { CIPHER_VIEW_BANNER, GATED_CIPHER_RELOADER } from "@bitwarden/vault";
import { COLLECTION_ACCESS_RULE_CALLOUT } from "@bitwarden/web-vault/app/admin-console/organizations/shared/components/collection-dialog/collection-access-rule-callout.token";
import { VAULT_ROW_LEASE_BADGE } from "@bitwarden/web-vault/app/vault/components/vault-items/vault-row-lease-badge.token";
import { CIPHER_OPEN_GATE } from "@bitwarden/web-vault/app/vault/individual-vault/cipher-open-gate";

import { ApproverInboxRequestsService } from "./approver-inbox/approver-inbox-requests.service";
import { CipherLeaseBannerComponent } from "./cipher-lease-banner/cipher-lease-banner.component";
import { PamCipherOpenGate } from "./cipher-open-gate.service";
import { CollectionAccessRuleCalloutComponent } from "./collection-access-rule-callout/collection-access-rule-callout.component";
import { PamGatedCipherReloader } from "./gated-cipher-reloader.service";
// DEMO ONLY: mock layer for the PAM API surface.
import { MockAccessEventService } from "./mock/mock-access-event.service";
import { MockPamApiService } from "./mock/mock-pam-api.service";
import { PamMockConfig } from "./mock/pam-mock-config";
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
 * DEMO ONLY: when `localStorage.pam-mock === "true"` the mock layer is swapped
 * in so a fraction of ciphers prompt for access and pending requests
 * auto-decide after a short delay. See `./mock/pam-mock-config.ts`.
 */
export function providePam(): SafeProvider[] {
  return [
    safeProvider({
      provide: PamApiService,
      useFactory: (
        apiService: ApiService,
        accessEvents: AccessEventService,
        mock: MockPamApiService,
      ) => (PamMockConfig.isEnabled() ? mock : new DefaultPamApiService(apiService, accessEvents)),
      deps: [ApiService, AccessEventService, MockPamApiService],
    }),
    safeProvider({
      provide: AccessEventService,
      useFactory: (
        notificationsService: ServerNotificationsService,
        mock: MockAccessEventService,
      ) =>
        PamMockConfig.isEnabled()
          ? mock
          : new DefaultAccessEventService(notificationsService.notifications$),
      deps: [ServerNotificationsService, MockAccessEventService],
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
