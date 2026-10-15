import { APP_INITIALIZER } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { SafeProvider, safeProvider } from "@bitwarden/angular/platform/utils/safe-provider";
import { SafeInjectionToken } from "@bitwarden/angular/services/injection-tokens";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { MessageSender } from "@bitwarden/common/platform/messaging";
import { StateProvider } from "@bitwarden/common/platform/state";
import { CipherLeaseStateService } from "@bitwarden/common/vault/abstractions/cipher-lease-state.service";

import { BrowserCipherLeaseStateService } from "../browser-cipher-lease-state.service";
import { PAM_REFRESH_LEASES } from "../lease-messages";

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
  ];
}
