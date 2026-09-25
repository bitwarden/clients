import {
  AccessEventService,
  AccessLeaseSdkService,
  AccessRefreshService,
  AccessRequestSdkService,
  LeasingErrorService,
} from "@bitwarden/bit-common/pam";
import { AccessLeasesSdkService } from "@bitwarden/bit-common/pam/services/access-leases-sdk.service";
import { AccessRequestsSdkService } from "@bitwarden/bit-common/pam/services/access-requests-sdk.service";
import { DefaultAccessEventService } from "@bitwarden/bit-common/pam/services/default-access-event.service";
import { DefaultAccessRefreshService } from "@bitwarden/bit-common/pam/services/default-access-refresh.service";
import { DefaultLeasingErrorService } from "@bitwarden/bit-common/pam/services/default-leasing-error.service";
import { VAULT_ROW_ACCESS_ACTION } from "@bitwarden/browser/vault/popup/components/vault/vault-list-items-container/vault-row-access-action.token";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { SafeProvider, safeProvider } from "@bitwarden/ui-common";
import { CIPHER_VIEW_BANNER, ITEM_DETAILS_STATE_BADGE } from "@bitwarden/vault";

import { CipherViewBannerComponent } from "./cipher-view-banner/cipher-view-banner.component";
import { ItemDetailsStateBadgeComponent } from "./item-details-state-badge/item-details-state-badge.component";
import { VaultRowAccessActionComponent } from "./vault-row-access-action/vault-row-access-action.component";

/** PAM providers for the extension popup's commercial `AppModule`. */
export function providePam(): SafeProvider[] {
  return [
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
    safeProvider({
      provide: AccessEventService,
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
      provide: ITEM_DETAILS_STATE_BADGE,
      useValue: ItemDetailsStateBadgeComponent,
    }),
    safeProvider({
      provide: CIPHER_VIEW_BANNER,
      useValue: CipherViewBannerComponent,
    }),
    safeProvider({
      provide: VAULT_ROW_ACCESS_ACTION,
      useValue: VaultRowAccessActionComponent,
    }),
  ];
}
