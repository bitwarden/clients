import { APP_INITIALIZER } from "@angular/core";
import { firstValueFrom } from "rxjs";

import {
  AccessEventService,
  AccessLeaseSdkService,
  AccessLeasesSdkService,
  AccessRefreshService,
  AccessRequestCancelService,
  AccessRequestSdkService,
  AccessRequestsSdkService,
  CipherViewBannerComponent,
  DefaultLeasingErrorService,
  ItemDetailsStateBadgeComponent,
  LeasingErrorService,
  MyLeasesService,
} from "@bitwarden/bit-common/pam";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { MessageSender } from "@bitwarden/common/platform/messaging";
import { StateProvider } from "@bitwarden/common/platform/state";
import { CipherLeaseStateService } from "@bitwarden/common/vault/abstractions/cipher-lease-state.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { SafeInjectionToken, SafeProvider, safeProvider } from "@bitwarden/ui-common";
import { CIPHER_VIEW_BANNER, ITEM_DETAILS_STATE_BADGE } from "@bitwarden/vault";

import { BrowserCipherLeaseStateService } from "../browser-cipher-lease-state.service";
import { PAM_REFRESH_LEASES } from "../lease-messages";

import { BrowserAccessEventService } from "./browser-access-event.service";
import { BrowserAccessRefreshService } from "./browser-access-refresh.service";

/** PAM providers for the commercial popup. */
export function providePam(): SafeProvider[] {
  return [
    safeProvider({
      provide: CipherLeaseStateService,
      useClass: BrowserCipherLeaseStateService,
      deps: [StateProvider, AccountService],
    }),
    safeProvider({
      // The popup receives no pushes, so it asks the background to re-read on open.
      provide: APP_INITIALIZER as SafeInjectionToken<() => Promise<void>>,
      useFactory: (accountService: AccountService, messageSender: MessageSender) => async () => {
        const userId = await firstValueFrom(accountService.activeAccount$.pipe(getOptionalUserId));
        if (userId != null) {
          messageSender.send(PAM_REFRESH_LEASES, { userId });
        }
      },
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
    // Only the banner reads it; `CipherLeaseStateService` stays on the background's leased copies.
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
      provide: ITEM_DETAILS_STATE_BADGE,
      useValue: ItemDetailsStateBadgeComponent,
    }),
  ];
}
