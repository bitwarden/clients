import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { DialogService, ToastService } from "@bitwarden/components";
import { SafeProvider, safeProvider } from "@bitwarden/ui-common";
import { PamNavBadgeService } from "@bitwarden/web-vault/app/pam/pam-nav-badge.service";
import { PAM_ORG_ADMIN_ROUTE } from "@bitwarden/web-vault/app/pam/pam-org-admin-route.token";
import { PAM_ROUTES } from "@bitwarden/web-vault/app/pam/pam-routes.token";

import { CidrValidationService } from "./access-rules/access-rule-edit/ip-allowlist/cidr-validation.service";
import { DefaultCidrValidationService } from "./access-rules/access-rule-edit/ip-allowlist/default-cidr-validation.service";
import { AccessBadgeTickerService } from "./access-state-badge/access-badge-ticker.service";
import { ApprovalPrivilegeService } from "./approvals/approval-privilege.service";
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
  ];
}
