import { APP_INITIALIZER, NgZone } from "@angular/core";

import {
  AccessEventService,
  AccessLeaseSdkService,
  AccessRefreshService,
  AccessRequestSdkService,
  LeasingErrorService,
  AccessLeasesSdkService,
  AccessRequestsSdkService,
  DefaultLeasingErrorService,
} from "@bitwarden/bit-pam";
import {
  CipherViewBannerComponent,
  ItemDetailsStateBadgeComponent,
  AccessRequestCancelService,
  controlledAccessItemFilter,
  ControlledAccessVaultFilterService,
  MyLeasesService,
  CIPHER_VIEW_BANNER_LAYOUT,
} from "@bitwarden/bit-pam-components";
import { FillCipherPolicy } from "@bitwarden/browser/autofill/services/abstractions/fill-cipher-policy";
import { VAULT_ROW_ICON } from "@bitwarden/browser/vault/popup/components/vault/vault-row-slots/vault-row-icon.token";
import { VAULT_ROW_SUBTITLE } from "@bitwarden/browser/vault/popup/components/vault/vault-row-slots/vault-row-subtitle.token";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { MessageSender } from "@bitwarden/common/platform/messaging";
import { StateProvider } from "@bitwarden/common/platform/state";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { RevealedCipherService } from "@bitwarden/common/vault/abstractions/revealed-cipher.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { SafeInjectionToken, SafeProvider, safeProvider } from "@bitwarden/ui-common";
import {
  CIPHER_VIEW_BANNER,
  ITEM_DETAILS_BADGE,
  VAULT_ITEM_FILTER,
  VAULT_ROW_ACTIONS,
} from "@bitwarden/vault";

import { requestLeaseRefresh } from "../lease-messages";
import { PamFillCipherPolicy } from "../pam-fill-cipher-policy";

import { BrowserAccessEventService } from "./browser-access-event.service";
import { BrowserAccessRefreshService } from "./browser-access-refresh.service";
import { PopupRevealedCipherService } from "./popup-revealed-cipher.service";
import { BrowserVaultRowAccessService } from "./vault-row-access/browser-vault-row-access.service";
import { VaultRowAccessIconComponent } from "./vault-row-access/vault-row-access-icon.component";

/** PAM providers for the commercial popup. */
export function providePam(): SafeProvider[] {
  return [
    safeProvider({
      provide: RevealedCipherService,
      useClass: PopupRevealedCipherService,
      deps: [StateProvider, AuthService, CipherService, MessageSender, LogService, NgZone],
    }),
    safeProvider({
      provide: FillCipherPolicy,
      useClass: PamFillCipherPolicy,
      deps: [CipherService, RevealedCipherService],
    }),
    safeProvider({
      // The popup receives no pushes, so it asks the background to re-read on open.
      provide: APP_INITIALIZER as SafeInjectionToken<() => Promise<void>>,
      useFactory: (accountService: AccountService, messageSender: MessageSender) => () =>
        requestLeaseRefresh(accountService, messageSender),
      deps: [AccountService, MessageSender],
      multi: true,
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
    // Only the banner reads it; `RevealedCipherService` stays on the background's leased copies.
    safeProvider({
      provide: MyLeasesService,
      useClass: MyLeasesService,
      deps: [AccessLeaseSdkService, LogService],
    }),
    safeProvider({
      provide: AccessEventService,
      useClass: BrowserAccessEventService,
      deps: [StateProvider, AccountService],
    }),
    safeProvider({
      provide: AccessRefreshService,
      useClass: BrowserAccessRefreshService,
      deps: [AccessEventService, AccountService, MessageSender],
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
      provide: CIPHER_VIEW_BANNER,
      useValue: CipherViewBannerComponent,
    }),
    safeProvider({
      provide: ITEM_DETAILS_BADGE,
      useValue: ItemDetailsStateBadgeComponent,
    }),
    // The popup's item view has no room to fold the request form out in place.
    safeProvider({
      provide: CIPHER_VIEW_BANNER_LAYOUT,
      useValue: "popup",
    }),
    // One per-row state read per list, shared by every option's count and the selection.
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
    // One instance behind the row's icon, subtitle and menu, so all three read the same statuses.
    safeProvider({
      provide: BrowserVaultRowAccessService,
      useClass: BrowserVaultRowAccessService,
      deps: [],
    }),
    safeProvider({
      provide: VAULT_ROW_ICON,
      useValue: VaultRowAccessIconComponent,
    }),
    safeProvider({
      provide: VAULT_ROW_SUBTITLE,
      useExisting: BrowserVaultRowAccessService,
    }),
    safeProvider({
      provide: VAULT_ROW_ACTIONS,
      useFactory: (rowAccess: BrowserVaultRowAccessService) => rowAccess.rowActions(),
      deps: [BrowserVaultRowAccessService],
    }),
  ];
}
