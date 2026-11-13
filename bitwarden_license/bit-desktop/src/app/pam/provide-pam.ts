import { APP_INITIALIZER, DestroyRef, NgZone } from "@angular/core";

import {
  AccessEventService,
  AccessLeaseSdkService,
  AccessLeasesSdkService,
  AccessRefreshService,
  AccessRequestSdkService,
  AccessRequestsSdkService,
  AccessRuleSdkService,
  AccessRulesSdkService,
  ApprovalSdkService,
  ApprovalsSdkService,
  DefaultAccessEventService,
  DefaultAccessRefreshService,
  DefaultLeasingErrorService,
  LeasingErrorService,
  PamNotificationSink,
} from "@bitwarden/bit-pam";
import {
  AccessBadgeTickerService,
  AccessRequestCancelService,
  ApprovalPrivilegeService,
  CipherViewBannerComponent,
  ControlledAccessVaultFilterService,
  controlledAccessColumn,
  controlledAccessItemFilter,
  GatedCollectionBannerComponent,
  GatedRequestActionsService,
  GovernedCollectionsService,
  ItemDetailsStateBadgeComponent,
  LeaseExtensionService,
  MyLeasesService,
} from "@bitwarden/bit-pam-components";
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
import { DESKTOP_SETTINGS_EXTRAS } from "@bitwarden/desktop/app/accounts/settings-extras.token";
import { PamNavBadgeService } from "@bitwarden/desktop/app/pam/pam-nav-badge.service";
import { PAM_DESKTOP_ROUTES } from "@bitwarden/desktop/app/pam/pam-routes.token";
import { VAULT_GATED_COLLECTION_BANNER } from "@bitwarden/desktop/vault/app/vault-v3/vault-gated-collection-banner.token";
import { StateProvider } from "@bitwarden/state";
import { SafeInjectionToken, SafeProvider, safeProvider } from "@bitwarden/ui-common";
import {
  CIPHER_VIEW_BANNER,
  ITEM_DETAILS_BADGE,
  VAULT_ITEM_COLUMN,
  VAULT_ITEM_FILTER,
  VAULT_ROW_ACTIONS,
} from "@bitwarden/vault";

import { DesktopPamNavBadgeService } from "./desktop-pam-nav-badge.service";
import { DesktopPamNotificationSink } from "./notifications/desktop-pam-notification-sink";
import { DesktopPamNotifier } from "./notifications/desktop-pam-notifier";
import { PamNotificationStateService } from "./notifications/pam-notification-state.service";
import { PamNotificationsSettingComponent } from "./notifications/pam-notifications-setting.component";
import { DesktopRevealedCipherService } from "./vault/desktop-revealed-cipher.service";
import { DesktopVaultRowActionsService } from "./vault/desktop-vault-row-actions.service";

/**
 * PAM's root-level providers for the commercial desktop build, including every OSS seam it fills:
 * the routes, nav badge, settings row, and the vault's cipher banner, item badge, filter chip,
 * Controlled access column, shared-folder banner, row-menu actions and the revealed view of a
 * leased item. Also starts the system-notification watcher at app initialization.
 */
export function provideDesktopPam(): SafeProvider[] {
  return [
    safeProvider({
      provide: PAM_DESKTOP_ROUTES,
      useValue: () => import("./pam-shell.routes").then((m) => m.PAM_SHELL_ROUTES),
    }),
    safeProvider({
      provide: AccessRequestSdkService,
      useClass: AccessRequestsSdkService,
      deps: [SdkService, AccountService, LogService],
    }),
    safeProvider({
      provide: AccessRuleSdkService,
      useClass: AccessRulesSdkService,
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
    // The server pushes ids-less ticks over the same channel the web vault listens on.
    safeProvider({
      provide: AccessEventService,
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
    // Root-level because the route guard resolves it before any route-provided service exists.
    safeProvider({
      provide: ApprovalPrivilegeService,
      useClass: ApprovalPrivilegeService,
      deps: [],
    }),
    safeProvider({
      provide: PamNavBadgeService,
      useClass: DesktopPamNavBadgeService,
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
    // Root-level so one cached lease read serves every item opened.
    safeProvider({
      provide: MyLeasesService,
      useClass: MyLeasesService,
      deps: [AccessLeaseSdkService, LogService],
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
      provide: LeaseExtensionService,
      useClass: LeaseExtensionService,
      deps: [
        AccessRequestSdkService,
        AccessLeaseSdkService,
        AccessRefreshService,
        DialogService,
        ToastService,
        I18nService,
        LogService,
      ],
    }),
    safeProvider({
      provide: GovernedCollectionsService,
      useClass: GovernedCollectionsService,
      deps: [AccessRuleSdkService, LogService],
    }),
    safeProvider({
      provide: VAULT_GATED_COLLECTION_BANNER,
      useValue: GatedCollectionBannerComponent,
    }),
    safeProvider({
      provide: CIPHER_VIEW_BANNER,
      useValue: CipherViewBannerComponent,
    }),
    safeProvider({
      provide: ITEM_DETAILS_BADGE,
      useValue: ItemDetailsStateBadgeComponent,
    }),
    // One instance behind the table chip and the column, so they share one per-row state cache.
    safeProvider({
      provide: ControlledAccessVaultFilterService,
      useClass: ControlledAccessVaultFilterService,
      deps: [],
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
    // Replaces the reveal-nothing default, so a live lease shows the item's secrets.
    safeProvider({
      provide: RevealedCipherService,
      useClass: DesktopRevealedCipherService,
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
      provide: GatedRequestActionsService,
      useClass: GatedRequestActionsService,
      deps: [
        AccessRequestSdkService,
        AccessRefreshService,
        AccessRequestCancelService,
        ConfigService,
      ],
    }),
    safeProvider({
      provide: DesktopVaultRowActionsService,
      useClass: DesktopVaultRowActionsService,
      deps: [GatedRequestActionsService, I18nService, AccountService, DestroyRef],
    }),
    safeProvider({
      provide: VAULT_ROW_ACTIONS,
      useFactory: (rowActions: DesktopVaultRowActionsService) => rowActions.rowActions(),
      deps: [DesktopVaultRowActionsService],
    }),
    safeProvider({
      provide: PamNotificationStateService,
      useClass: PamNotificationStateService,
      deps: [StateProvider],
    }),
    safeProvider({
      provide: PamNotificationSink,
      useClass: DesktopPamNotificationSink,
      deps: [I18nService],
    }),
    safeProvider({
      provide: DesktopPamNotifier,
      useClass: DesktopPamNotifier,
      deps: [
        AccountService,
        AuthService,
        ConfigService,
        OrganizationService,
        AccessEventService,
        AccessRequestSdkService,
        AccessLeaseSdkService,
        ApprovalSdkService,
        ApprovalPrivilegeService,
        PamNotificationStateService,
        PamNotificationSink,
        LogService,
      ],
    }),
    safeProvider({
      provide: APP_INITIALIZER as SafeInjectionToken<() => void>,
      useFactory: (notifier: DesktopPamNotifier) => () => {
        notifier.start();
      },
      deps: [DesktopPamNotifier],
      multi: true,
    }),
    safeProvider({
      provide: DESKTOP_SETTINGS_EXTRAS,
      useValue: [PamNotificationsSettingComponent],
    }),
  ];
}
