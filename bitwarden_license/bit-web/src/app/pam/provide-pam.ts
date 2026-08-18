import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { ToastService } from "@bitwarden/components";
import { SafeProvider, safeProvider } from "@bitwarden/ui-common";
import { CIPHER_VIEW_BANNER, GATED_CIPHER_RELOADER } from "@bitwarden/vault";
import { COLLECTION_ACCESS_RULE_CALLOUT } from "@bitwarden/web-vault/app/admin-console/organizations/shared/components/collection-dialog/collection-access-rule-callout.token";
import { PamNavBadgeService } from "@bitwarden/web-vault/app/pam/pam-nav-badge.service";
import { VaultRowAccessActionsService } from "@bitwarden/web-vault/app/vault/components/vault-items/vault-row-access-actions.service";
import { VAULT_ROW_LEASE_BADGE } from "@bitwarden/web-vault/app/vault/components/vault-items/vault-row-lease-badge.token";

import { DefaultAuditApiService } from "./access-audit/default-audit-api.service";
import { CidrValidationService } from "./access-rules/access-rule-edit/ip-allowlist/cidr-validation.service";
import { DefaultCidrValidationService } from "./access-rules/access-rule-edit/ip-allowlist/default-cidr-validation.service";
import { CipherViewBannerComponent } from "./cipher-view-banner/cipher-view-banner.component";
import { CollectionAccessRuleCalloutComponent } from "./collection-access-rule-callout/collection-access-rule-callout.component";
import { AccessLeasesSdkService } from "./services/access-leases-sdk.service";
import { AccessRequestCancelService } from "./services/access-request-cancel.service";
import { AccessRequestsSdkService } from "./services/access-requests-sdk.service";
import { AccessRulesSdkService } from "./services/access-rules-sdk.service";
import { ApprovalsSdkService } from "./services/approvals-sdk.service";
import { DefaultAccessEventService } from "./services/default-access-event.service";
import { DefaultAccessRefreshService } from "./services/default-access-refresh.service";
import { DefaultLeasingErrorService } from "./services/default-leasing-error.service";
import { GovernedCollectionsService } from "./services/governed-collections.service";
import { PamGatedCipherReloader } from "./services/pam-gated-cipher-reloader.service";
import { DefaultPamNavBadgeService } from "./services/pam-nav-badge.service";
import { DefaultVaultRowAccessActionsService } from "./services/vault-row-access-actions.service";
import { VaultRowLeaseBadgeComponent } from "./vault-row-lease-badge/vault-row-lease-badge.component";

import {
  AccessEventService,
  ApprovalSdkService,
  AuditApiService,
  AccessLeaseSdkService,
  AccessRefreshService,
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
 * `AccessRequestSdkService` to `AccessRequestsSdkService`,
 * `AccessLeaseSdkService` to `AccessLeasesSdkService` (the "My access"
 * request/lease lifecycle, both served via the Rust SDK's
 * `commercial().pam().access_requests()`/`leases()` clients), and
 * `ApprovalSdkService` to `ApprovalsSdkService` (the approver's inbox, history,
 * and decide mutation, served via `commercial().pam().approvals()`), plus
 * `CidrValidationService` to its SDK-backed default for the IP-allowlist editor.
 *
 * Also fills the OSS seams PAM owns, each injected `{ optional: true }` on the OSS
 * side so an unprovided token stays inert: `CIPHER_VIEW_BANNER` (the requester's
 * leasing entry point on an open cipher) and `VAULT_ROW_LEASE_BADGE` (the per-row
 * access-state pill, on cipher AND collection rows — collection rows show the
 * "Privileged" pill backed by the shared `GovernedCollectionsService` lookup),
 * both component classes, plus `GATED_CIPHER_RELOADER` (the
 * observable that reveals a gated cipher in place once a lease covers it),
 * `COLLECTION_ACCESS_RULE_CALLOUT` (the governing-rule notice in the collection
 * edit dialog), `PamNavBadgeService` (the nav badge count), and
 * `VaultRowAccessActionsService` (withdrawing a gated row's outstanding access
 * request from the vault-list menu).
 *
 * `AccessEventService` turns the server's access push into a tick; `AccessRefreshService`
 * merges that tick with local mutations so every leasing surface re-reads through one path.
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
      provide: ApprovalSdkService,
      useClass: ApprovalsSdkService,
      deps: [SdkService, AccountService, LogService],
    }),
    safeProvider({
      provide: LeasingErrorService,
      useClass: DefaultLeasingErrorService,
      deps: [],
    }),
    // The module's only HTTP-backed contract — see `access-audit/audit-api.service.ts` for why it is
    // the one exception to the SDK rule. Bound here so swapping it for an SDK-backed implementation,
    // once the SDK exposes an audit surface, is a change to this line alone.
    safeProvider({
      provide: AuditApiService,
      useClass: DefaultAuditApiService,
      deps: [ApiService, AccountService],
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
    // Root-level (not per-badge) so every collection-row badge AND the collection-dialog
    // callout share one cached per-org rules read.
    safeProvider({
      provide: GovernedCollectionsService,
      useClass: GovernedCollectionsService,
      deps: [AccessRuleSdkService, LogService],
    }),
    safeProvider({
      provide: CIPHER_VIEW_BANNER,
      useValue: CipherViewBannerComponent,
    }),
    safeProvider({
      provide: AccessEventService,
      // A factory, not useClass: the service takes the notification STREAM rather than the service,
      // so it has no opinion about transport and unit tests hand it a plain Subject.
      useFactory: (notificationsService: ServerNotificationsService) =>
        new DefaultAccessEventService(notificationsService.notifications$),
      deps: [ServerNotificationsService],
    }),
    safeProvider({
      provide: AccessRefreshService,
      useClass: DefaultAccessRefreshService,
      deps: [AccessEventService],
    }),
    safeProvider({
      provide: PamNavBadgeService,
      useClass: DefaultPamNavBadgeService,
      deps: [AccessRequestSdkService, AccessEventService, ConfigService, LogService],
    }),
    safeProvider({
      provide: COLLECTION_ACCESS_RULE_CALLOUT,
      useValue: CollectionAccessRuleCalloutComponent,
    }),
    safeProvider({
      provide: GATED_CIPHER_RELOADER,
      useClass: PamGatedCipherReloader,
      deps: [AccessRequestSdkService, AccessRefreshService, ApiService, LogService],
    }),
    // The shared cipher-scoped cancel flow — one implementation behind both the cipher-view
    // banner and the vault-row menu, so the withdraw semantics and outcome copy cannot drift.
    safeProvider({
      provide: AccessRequestCancelService,
      useClass: AccessRequestCancelService,
      deps: [AccessRequestSdkService, AccessRefreshService, ToastService, I18nService, LogService],
    }),
    safeProvider({
      provide: VaultRowAccessActionsService,
      useClass: DefaultVaultRowAccessActionsService,
      deps: [
        AccessRequestSdkService,
        AccessRefreshService,
        AccessRequestCancelService,
        ConfigService,
      ],
    }),
  ];
}
