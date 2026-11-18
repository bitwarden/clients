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
  PamConnectivityService,
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
import { CommandDefinition, MessageListener } from "@bitwarden/common/platform/messaging";
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

import { DesktopAccessEventService } from "./connectivity/desktop-access-event.service";
import { DesktopPamConnectivityService } from "./connectivity/desktop-pam-connectivity.service";
import { guardPamCalls } from "./connectivity/pam-call-guard";
import { DesktopPamNavBadgeService } from "./desktop-pam-nav-badge.service";
import { DesktopPamNotificationSink } from "./notifications/desktop-pam-notification-sink";
import { DesktopPamNotifier } from "./notifications/desktop-pam-notifier";
import { PamNotificationStateService } from "./notifications/pam-notification-state.service";
import { PamNotificationsSettingComponent } from "./notifications/pam-notifications-setting.component";
import { DesktopRevealedCipherService } from "./vault/desktop-revealed-cipher.service";
import { DesktopVaultRowActionsService } from "./vault/desktop-vault-row-actions.service";

/** The sync service's completion message, read as evidence the server answers again. */
const SYNC_COMPLETED = new CommandDefinition<{ successfully?: boolean }>("syncCompleted");

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
    // Whether PAM can reach the server; see `connectivity/`.
    safeProvider({
      provide: DesktopPamConnectivityService,
      useFactory: (notificationsService: ServerNotificationsService, messages: MessageListener) =>
        new DesktopPamConnectivityService(
          window,
          notificationsService.notifications$,
          messages.messages$(SYNC_COMPLETED),
        ),
      deps: [ServerNotificationsService, MessageListener],
    }),
    safeProvider({
      provide: PamConnectivityService,
      useExisting: DesktopPamConnectivityService,
    }),
    // Every PAM SDK call is bounded by a timeout and reports its outcome to connectivity.
    safeProvider({
      provide: AccessRequestSdkService,
      useFactory: (
        sdk: SdkService,
        account: AccountService,
        log: LogService,
        connectivity: DesktopPamConnectivityService,
      ) => guardPamCalls(new AccessRequestsSdkService(sdk, account, log), connectivity),
      deps: [SdkService, AccountService, LogService, DesktopPamConnectivityService],
    }),
    safeProvider({
      provide: AccessRuleSdkService,
      useFactory: (
        sdk: SdkService,
        account: AccountService,
        log: LogService,
        connectivity: DesktopPamConnectivityService,
      ) => guardPamCalls(new AccessRulesSdkService(sdk, account, log), connectivity),
      deps: [SdkService, AccountService, LogService, DesktopPamConnectivityService],
    }),
    safeProvider({
      provide: AccessLeaseSdkService,
      useFactory: (
        sdk: SdkService,
        account: AccountService,
        log: LogService,
        connectivity: DesktopPamConnectivityService,
      ) => guardPamCalls(new AccessLeasesSdkService(sdk, account, log), connectivity),
      deps: [SdkService, AccountService, LogService, DesktopPamConnectivityService],
    }),
    safeProvider({
      provide: ApprovalSdkService,
      useFactory: (
        sdk: SdkService,
        account: AccountService,
        log: LogService,
        connectivity: DesktopPamConnectivityService,
      ) => guardPamCalls(new ApprovalsSdkService(sdk, account, log), connectivity),
      deps: [SdkService, AccountService, LogService, DesktopPamConnectivityService],
    }),
    safeProvider({
      provide: LeasingErrorService,
      useClass: DefaultLeasingErrorService,
      deps: [],
    }),
    // The server pushes ids-less ticks over the same channel the web vault listens on; a
    // reconnect ticks too, since pushes sent while offline were missed.
    safeProvider({
      provide: AccessEventService,
      useFactory: (
        notificationsService: ServerNotificationsService,
        accountService: AccountService,
        connectivity: DesktopPamConnectivityService,
      ) =>
        new DesktopAccessEventService(
          new DefaultAccessEventService(
            notificationsService.notifications$,
            accountService.activeAccount$.pipe(getOptionalUserId),
          ),
          connectivity.reconnected$,
        ),
      deps: [ServerNotificationsService, AccountService, DesktopPamConnectivityService],
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
        PamConnectivityService,
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
        PamConnectivityService,
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
      deps: [
        GatedRequestActionsService,
        I18nService,
        AccountService,
        DestroyRef,
        PamConnectivityService,
      ],
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
    // While the server is marked unreachable on a working network, a lease read checks whether it
    // answers again. A reconnect also drops the cached lease list the item gate reads.
    safeProvider({
      provide: APP_INITIALIZER as SafeInjectionToken<() => void>,
      useFactory:
        (
          connectivity: DesktopPamConnectivityService,
          leases: AccessLeaseSdkService,
          myLeases: MyLeasesService,
        ) =>
        () => {
          connectivity.startProbing(() => leases.listMyLeases());
          connectivity.reconnected$.subscribe(() => myLeases.invalidate());
        },
      deps: [DesktopPamConnectivityService, AccessLeaseSdkService, MyLeasesService],
      multi: true,
    }),
    safeProvider({
      provide: DESKTOP_SETTINGS_EXTRAS,
      useValue: [PamNotificationsSettingComponent],
    }),
  ];
}
