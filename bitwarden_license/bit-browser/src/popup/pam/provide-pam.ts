import {
  AccessEventService,
  AccessLeaseSdkService,
  AccessRefreshService,
  AccessRequestSdkService,
  LeasingErrorService,
} from "@bitwarden/bit-common/pam";
import { AccessLeasesSdkService } from "@bitwarden/bit-common/pam/services/access-leases-sdk.service";
import { AccessRequestsSdkService } from "@bitwarden/bit-common/pam/services/access-requests-sdk.service";
import { DefaultAccessRefreshService } from "@bitwarden/bit-common/pam/services/default-access-refresh.service";
import { DefaultLeasingErrorService } from "@bitwarden/bit-common/pam/services/default-leasing-error.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { SafeProvider, safeProvider } from "@bitwarden/ui-common";
import { ITEM_DETAILS_BADGE } from "@bitwarden/vault";

import { InertAccessEventService } from "./inert-access-event.service";
import { ItemDetailsStateBadgeComponent } from "./item-details-state-badge/item-details-state-badge.component";

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
      useClass: InertAccessEventService,
      deps: [],
    }),
    safeProvider({
      provide: AccessRefreshService,
      useClass: DefaultAccessRefreshService,
      deps: [AccessEventService],
    }),
    safeProvider({
      provide: ITEM_DETAILS_BADGE,
      useValue: ItemDetailsStateBadgeComponent,
    }),
  ];
}
