import { ApiService } from "@bitwarden/common/abstractions/api.service";
import {
  CipherLeaseBannerComponent,
  DefaultPamApiService,
  AccessEventService,
  LeasedCipherFetcher,
  PamApiService,
  RequestAccessTrigger,
} from "@bitwarden/pam";
import { SafeProvider, safeProvider } from "@bitwarden/ui-common";
import { CIPHER_VIEW_BANNER } from "@bitwarden/vault";

import { CIPHER_OPEN_GATE } from "../vault/individual-vault/cipher-open-gate";

import { PamCipherOpenGate } from "./cipher-open-gate.service";
// DEMO ONLY: mock layer for the PAM API surface.
import { MockAccessEventService } from "./mock/mock-access-event.service";
import { MockPamApiService } from "./mock/mock-pam-api.service";
import { PamMockConfig } from "./mock/pam-mock-config";
import { WebRequestAccessTrigger } from "./request-access-trigger/web-request-access-trigger.service";

/**
 * PAM-owned root-level providers. Consumed by `core.module.ts` so the web shell
 * imports a single function instead of enumerating each PAM provider inline.
 *
 * DEMO ONLY: when `localStorage.pam-mock === "true"` the mock layer is swapped
 * in so a fraction of ciphers prompt for access and pending requests
 * auto-decide after a short delay. See `./mock/pam-mock-config.ts`.
 */
export function providePam(): SafeProvider[] {
  return [
    safeProvider({
      provide: PamApiService,
      useFactory: (
        apiService: ApiService,
        accessEvents: AccessEventService,
        mock: MockPamApiService,
      ) => (PamMockConfig.isEnabled() ? mock : new DefaultPamApiService(apiService, accessEvents)),
      deps: [ApiService, AccessEventService, MockPamApiService],
    }),
    safeProvider({
      provide: AccessEventService,
      useExisting: MockAccessEventService,
      deps: [],
    }),
    safeProvider({
      provide: CIPHER_OPEN_GATE,
      useExisting: PamCipherOpenGate,
      deps: [],
    }),
    safeProvider({
      provide: CIPHER_VIEW_BANNER,
      useValue: CipherLeaseBannerComponent,
    }),
    safeProvider({
      provide: RequestAccessTrigger,
      useClass: WebRequestAccessTrigger,
      deps: [],
    }),
    safeProvider({
      provide: LeasedCipherFetcher,
      useFactory: (pamApiService: PamApiService) => new LeasedCipherFetcher(pamApiService),
      deps: [PamApiService],
    }),
  ];
}
