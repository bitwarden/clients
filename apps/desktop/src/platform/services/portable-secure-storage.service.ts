import { Observable, of } from "rxjs";

import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import {
  SecureStorageService,
  SupportStatus,
} from "@bitwarden/common/platform/storage/secure-storage.service";

export class PortableSecureStorageService implements SecureStorageService {
  constructor(storageService: AbstractStorageService) {
    this.support$ = of({
      type: "not-preferred",
      service: storageService,
      reason: "portable-desktop",
    } satisfies SupportStatus);
  }

  support$: Observable<SupportStatus>;
}
