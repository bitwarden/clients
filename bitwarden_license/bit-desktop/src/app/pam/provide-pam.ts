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
  GatedRequestActionsService,
  GovernedCollectionsService,
  GovernedSharedFolderIconComponent,
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
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { MessageListener } from "@bitwarden/common/platform/messaging";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { RevealedCipherService } from "@bitwarden/common/vault/abstractions/revealed-cipher.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { DESKTOP_SETTINGS_EXTRAS } from "@bitwarden/desktop/app/accounts/settings-extras.token";
import { PamNavBadgeService } from "@bitwarden/desktop/app/pam/pam-nav-badge.service";
import { PAM_DESKTOP_ROUTES } from "@bitwarden/desktop/app/pam/pam-routes.token";
import { LeasedSshKeyService } from "@bitwarden/desktop/autofill/abstractions/leased-ssh-key.service";
import { VAULT_GATED_COLLECTION_BANNER } from "@bitwarden/desktop/vault/app/vault-v3/vault-gated-collection-banner.token";
import { StateProvider } from "@bitwarden/state";
import { SafeInjectionToken, SafeProvider, safeProvider } from "@bitwarden/ui-common";
import {
  CIPHER_VIEW_BANNER,
  ITEM_DETAILS_BADGE,
  SHARED_FOLDER_DECORATION,
  VAULT_ITEM_COLUMN,
  VAULT_ITEM_FILTER,
  VAULT_ROW_ACTIONS,
} from "@bitwarden/vault";

import { DesktopAccessBadgeTickerService } from "./desktop-access-badge-ticker.service";
import { DesktopPamNavBadgeService } from "./desktop-pam-nav-badge.service";
import { DesktopPamNotificationSink } from "./notifications/desktop-pam-notification-sink";
import { DesktopPamNotifier } from "./notifications/desktop-pam-notifier";
import { PamNotificationStateService } from "./notifications/pam-notification-state.service";
import { PamNotificationsSettingComponent } from "./notifications/pam-notifications-setting.component";
import { DesktopGatedCollectionBannerComponent } from "./vault/desktop-gated-collection-banner.component";
import { DesktopLeasedClipboardService } from "./vault/desktop-leased-clipboard.service";
import { DesktopLeasedSshKeyService } from "./vault/desktop-leased-ssh-key.service";
import { DesktopRevealedCipherService } from "./vault/desktop-revealed-cipher.service";
import { DesktopVaultRowActionsService } from "./vault/desktop-vault-row-actions.service";

/**
 * PAM's root-level providers for the commercial desktop build, including every OSS seam it fills:
 * the routes, nav badge, settings row, and the vault's cipher banner, item badge, filter chip,
 * Controlled access column, shared-folder banner and lock, row-menu actions, the revealed view of a
 * leased item and the SSH agent's leased keys. Also starts the system-notification watcher at app initialization.
 */
export function provideDesktopPam(): SafeProvider[] {
  return [
    safeProvider({
      provide: PAM_DESKTOP_ROUTES,
      useValue: () => import("./pam-shell.routes").then((m) => m.PAM_SHELL_ROUTES),
    }),
    // One lease clock a wall-clock rollback cannot hold back, for every countdown and reveal.
    safeProvider({
      provide: DesktopAccessBadgeTickerService,
      useClass: DesktopAccessBadgeTickerService,
      deps: [],
    }),
    safeProvider({
      provide: AccessBadgeTickerService,
      useExisting: DesktopAccessBadgeTickerService,
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
      useValue: DesktopGatedCollectionBannerComponent,
    }),
    safeProvider({
      provide: CIPHER_VIEW_BANNER,
      useValue: CipherViewBannerComponent,
    }),
    safeProvider({
      provide: ITEM_DETAILS_BADGE,
      useValue: ItemDetailsStateBadgeComponent,
    }),
    // The lock after a governed shared folder's name, the same component the web vault binds.
    safeProvider({
      provide: SHARED_FOLDER_DECORATION,
      useValue: GovernedSharedFolderIconComponent,
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
    // Clears a value copied from a leased item off the clipboard when its lease ends.
    safeProvider({
      provide: DesktopLeasedClipboardService,
      useClass: DesktopLeasedClipboardService,
      deps: [MessageListener, PlatformUtilsService, TotpService, LogService],
    }),
    // Replaces the reveal-nothing default, so a live lease shows the item's secrets. One instance
    // behind both tokens, so the SSH agent's leased keys come from the same reveals.
    safeProvider({
      provide: RevealedCipherService,
      useExisting: DesktopRevealedCipherService,
    }),
    safeProvider({
      provide: DesktopRevealedCipherService,
      useClass: DesktopRevealedCipherService,
      deps: [
        AccessRequestSdkService,
        AccessRefreshService,
        DesktopAccessBadgeTickerService,
        AccessLeaseSdkService,
        AccountService,
        AuthService,
        NgZone,
        LogService,
        DesktopLeasedClipboardService,
      ],
    }),
    // Lets the SSH agent serve a gated item's key while its lease is live. The IPC decision is
    // written up under "SSH agent and leased keys" in this folder's notes.
    safeProvider({
      provide: LeasedSshKeyService,
      useClass: DesktopLeasedSshKeyService,
      deps: [
        DesktopRevealedCipherService,
        AccessLeaseSdkService,
        AccessRefreshService,
        AccessBadgeTickerService,
        CipherService,
        ConfigService,
        OrganizationService,
        AccountService,
        AuthService,
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
