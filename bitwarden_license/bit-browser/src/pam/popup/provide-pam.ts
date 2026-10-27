import { APP_INITIALIZER, NgZone } from "@angular/core";

import { AccessEventService } from "@bitwarden/bit-common/pam/abstractions/access-event.service";
import { AccessLeaseSdkService } from "@bitwarden/bit-common/pam/abstractions/access-lease-sdk.service";
import { AccessRefreshService } from "@bitwarden/bit-common/pam/abstractions/access-refresh.service";
import { AccessRequestSdkService } from "@bitwarden/bit-common/pam/abstractions/access-request-sdk.service";
import { LeasingErrorService } from "@bitwarden/bit-common/pam/abstractions/leasing-error.service";
import { CipherViewBannerComponent } from "@bitwarden/bit-common/pam/cipher-view-banner/cipher-view-banner.component";
import { ItemDetailsStateBadgeComponent } from "@bitwarden/bit-common/pam/item-details-state-badge/item-details-state-badge.component";
import { AccessLeasesSdkService } from "@bitwarden/bit-common/pam/services/access-leases-sdk.service";
import { AccessRequestCancelService } from "@bitwarden/bit-common/pam/services/access-request-cancel.service";
import { AccessRequestsSdkService } from "@bitwarden/bit-common/pam/services/access-requests-sdk.service";
import { DefaultLeasingErrorService } from "@bitwarden/bit-common/pam/services/default-leasing-error.service";
import { MyLeasesService } from "@bitwarden/bit-common/pam/services/my-leases.service";
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
import { CIPHER_VIEW_BANNER, ITEM_DETAILS_BADGE } from "@bitwarden/vault";

import { requestLeaseRefresh } from "../lease-messages";

import { BrowserAccessEventService } from "./browser-access-event.service";
import { BrowserAccessRefreshService } from "./browser-access-refresh.service";
import { PopupRevealedCipherService } from "./popup-revealed-cipher.service";

/** PAM providers for the commercial popup. */
export function providePam(): SafeProvider[] {
  return [
    safeProvider({
      provide: RevealedCipherService,
      useClass: PopupRevealedCipherService,
      deps: [StateProvider, AuthService, CipherService, MessageSender, LogService, NgZone],
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
  ];
}
