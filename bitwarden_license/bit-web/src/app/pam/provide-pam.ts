import { NgZone } from "@angular/core";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { RevealedCipherService } from "@bitwarden/common/vault/abstractions/revealed-cipher.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { SafeProvider, safeProvider } from "@bitwarden/ui-common";
import {
  CIPHER_VIEW_BANNER,
  ITEM_DETAILS_BADGE,
  SHARED_FOLDER_DECORATION,
  VAULT_ITEM_COLUMN,
  VAULT_ITEM_FILTER,
} from "@bitwarden/vault";
import { COLLECTION_ACCESS_RULE_CALLOUT } from "@bitwarden/web-vault/app/admin-console/organizations/shared/components/collection-dialog/collection-access-rule-callout.token";
import { PamNavBadgeService } from "@bitwarden/web-vault/app/pam/pam-nav-badge.service";
import { PAM_ORG_ADMIN_ROUTE } from "@bitwarden/web-vault/app/pam/pam-org-admin-route.token";
import { PAM_ROUTES } from "@bitwarden/web-vault/app/pam/pam-routes.token";
import { VaultRowAccessActionsService } from "@bitwarden/web-vault/app/vault/components/vault-items/vault-row-access-actions.service";
import { VAULT_ROW_LEASE_BADGE } from "@bitwarden/web-vault/app/vault/components/vault-items/vault-row-lease-badge.token";
import { VAULT_CONTROLLED_ACCESS_FILTER } from "@bitwarden/web-vault/app/vault/individual-vault/vault-controlled-access-filter.token";
import { VAULT_FILTER_GATED_COLLECTION_INDICATOR } from "@bitwarden/web-vault/app/vault/individual-vault/vault-filter/shared/components/pam/vault-filter-gated-collection-indicator.token";
import { VAULT_GATED_COLLECTION_BANNER } from "@bitwarden/web-vault/app/vault/individual-vault/vault-gated-collection-banner.token";

import { CidrValidationService } from "./access-rules/access-rule-edit/ip-allowlist/cidr-validation.service";
import { DefaultCidrValidationService } from "./access-rules/access-rule-edit/ip-allowlist/default-cidr-validation.service";
import { AccessBadgeTickerService } from "./access-state-badge/access-badge-ticker.service";
import { ApprovalPrivilegeService } from "./approvals/approval-privilege.service";
import { CipherViewBannerComponent } from "./cipher-view-banner/cipher-view-banner.component";
import { CollectionAccessRuleCalloutComponent } from "./collection-access-rule-callout/collection-access-rule-callout.component";
import { GatedCollectionBannerComponent } from "./gated-collection-banner/gated-collection-banner.component";
import { ItemDetailsStateBadgeComponent } from "./item-details-state-badge/item-details-state-badge.component";
import { DefaultRotationSdkService } from "./rotation/default-rotation-sdk.service";
import { AccessLeasesSdkService } from "./services/access-leases-sdk.service";
import { AccessRequestCancelService } from "./services/access-request-cancel.service";
import { AccessRequestsSdkService } from "./services/access-requests-sdk.service";
import { AccessRulesSdkService } from "./services/access-rules-sdk.service";
import { ApprovalsSdkService } from "./services/approvals-sdk.service";
import { DefaultAccessEventService } from "./services/default-access-event.service";
import { DefaultAccessRefreshService } from "./services/default-access-refresh.service";
import { DefaultLeasingErrorService } from "./services/default-leasing-error.service";
import { GovernedCollectionsService } from "./services/governed-collections.service";
import { MyLeasesService } from "./services/my-leases.service";
import { DefaultPamNavBadgeService } from "./services/pam-nav-badge.service";
import { PamRevealedCipherService } from "./services/pam-revealed-cipher.service";
import { DefaultVaultRowAccessActionsService } from "./services/vault-row-access-actions.service";
import { GovernedSharedFolderIconComponent } from "./shared-folder-decoration/governed-shared-folder-icon.component";
import { controlledAccessItemFilter } from "./vault-filter-controlled-access/controlled-access-item-filter";
import { ControlledAccessVaultFilterService } from "./vault-filter-controlled-access/controlled-access-vault-filter.service";
import { GatedCollectionFilterIndicatorComponent } from "./vault-filter-gated-collection/gated-collection-filter-indicator.component";
import { controlledAccessColumn } from "./vault-item-column/controlled-access-column";
import { VaultRowLeaseBadgeComponent } from "./vault-row-lease-badge/vault-row-lease-badge.component";

import {
  AccessEventService,
  ApprovalSdkService,
  AccessLeaseSdkService,
  AccessRefreshService,
  AccessRequestSdkService,
  AccessRuleSdkService,
  LeasingErrorService,
  RotationSdkService,
} from ".";

/**
 * PAM-owned root-level providers. Consumed by the commercial web `AppModule` so
 * the shell imports a single function instead of enumerating each PAM provider
 * inline. Binds `AccessRuleSdkService` (the abstract CRUD contract from
 * `.`) to `AccessRulesSdkService`, which serves access-rule
 * CRUD via the Rust SDK's `commercial().pam().access_rules()` client, and
 * `CidrValidationService` to its SDK-backed default for the IP-allowlist editor.
 */
export function providePam(): SafeProvider[] {
  return [
    safeProvider({
      provide: PAM_ROUTES,
      useValue: () =>
        import("./access-requests/access-requests-routing.module").then(
          (m) => m.AccessRequestsRoutingModule,
        ),
    }),
    // Must match the path the commercial `OrganizationsRoutingModule` mounts the PAM pages at.
    safeProvider({
      provide: PAM_ORG_ADMIN_ROUTE,
      useValue: "pam",
    }),
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
    safeProvider({
      provide: RotationSdkService,
      useClass: DefaultRotationSdkService,
      deps: [SdkService, AccountService, LogService],
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
    safeProvider({
      provide: VAULT_FILTER_GATED_COLLECTION_INDICATOR,
      useValue: GatedCollectionFilterIndicatorComponent,
    }),
    safeProvider({
      provide: VAULT_GATED_COLLECTION_BANNER,
      useValue: GatedCollectionBannerComponent,
    }),
    // One instance behind the sidebar filter, the table chip, and the column, so they share one
    // per-row state cache.
    safeProvider({
      provide: ControlledAccessVaultFilterService,
      useClass: ControlledAccessVaultFilterService,
      deps: [],
    }),
    safeProvider({
      provide: VAULT_CONTROLLED_ACCESS_FILTER,
      useExisting: ControlledAccessVaultFilterService,
    }),
    safeProvider({
      provide: VAULT_ITEM_FILTER,
      useFactory: controlledAccessItemFilter,
      deps: [I18nService, ControlledAccessVaultFilterService],
    }),
    safeProvider({
      provide: VAULT_ITEM_COLUMN,
      useFactory: controlledAccessColumn,
      deps: [I18nService, ConfigService, ControlledAccessVaultFilterService],
    }),
    // Root-level because the route guard resolves it before any route-provided service exists.
    safeProvider({
      provide: ApprovalPrivilegeService,
      useClass: ApprovalPrivilegeService,
      deps: [],
    }),
    // Root-level so the banner and repeated dialog opens share one cached per-org rules read.
    safeProvider({
      provide: GovernedCollectionsService,
      useClass: GovernedCollectionsService,
      deps: [AccessRuleSdkService, LogService],
    }),
    // Root-level so one cached lease read serves every item opened.
    safeProvider({
      provide: MyLeasesService,
      useClass: MyLeasesService,
      deps: [AccessLeaseSdkService, LogService],
    }),
    safeProvider({
      provide: CIPHER_VIEW_BANNER,
      useValue: CipherViewBannerComponent,
    }),
    safeProvider({
      provide: ITEM_DETAILS_BADGE,
      useValue: ItemDetailsStateBadgeComponent,
    }),
    safeProvider({
      provide: SHARED_FOLDER_DECORATION,
      useValue: GovernedSharedFolderIconComponent,
    }),
    safeProvider({
      provide: AccessEventService,
      // A factory, since the service takes the notification stream rather than the service.
      useFactory: (
        notificationsService: ServerNotificationsService,
        accountService: AccountService,
      ) =>
        new DefaultAccessEventService(
          notificationsService.notifications$,
          accountService.activeAccount$.pipe(getOptionalUserId),
        ),
      deps: [ServerNotificationsService, AccountService],
    }),
    safeProvider({
      provide: AccessRefreshService,
      useClass: DefaultAccessRefreshService,
      deps: [AccessEventService],
    }),
    safeProvider({
      provide: PamNavBadgeService,
      useClass: DefaultPamNavBadgeService,
      deps: [
        AccessRequestSdkService,
        ApprovalSdkService,
        ApprovalPrivilegeService,
        AccessEventService,
        AccessRefreshService,
        AccessBadgeTickerService,
        AccountService,
        OrganizationService,
        ConfigService,
        LogService,
      ],
    }),
    safeProvider({
      provide: COLLECTION_ACCESS_RULE_CALLOUT,
      useValue: CollectionAccessRuleCalloutComponent,
    }),
    safeProvider({
      provide: RevealedCipherService,
      useClass: PamRevealedCipherService,
      deps: [
        AccessRequestSdkService,
        AccessRefreshService,
        AccessBadgeTickerService,
        AccessLeaseSdkService,
        AccountService,
        AuthService,
        NgZone,
        LogService,
      ],
    }),
    safeProvider({
      provide: AccessRequestCancelService,
      useClass: AccessRequestCancelService,
      deps: [
        AccessRequestSdkService,
        AccessRefreshService,
        DialogService,
        ToastService,
        I18nService,
        LogService,
      ],
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
