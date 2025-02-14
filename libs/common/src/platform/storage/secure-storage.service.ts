import { Observable, of } from "rxjs";

import { AbstractStorageService } from "../abstractions/storage.service";

export type SupportStatus =
  | {
      type: "supported";
      service: AbstractStorageService;
    }
  | { type: "not-preferred"; service: AbstractStorageService; reason: string }
  | { type: "needs-configuration"; reason: string }
  | { type: "not-supported"; reason: string };

export abstract class SecureStorageService {
  /**
   * Returns an observable stream of a Rust-like enum showing if secure storage is
   * supported for a given platform.
   *
   * If the type is `supported` then the service property _should_ be used to store
   * security sensitive information, particularly keys and access tokens that need
   * to be available after a restart of the application.
   *
   * If the type is `not-preferred` then the service property should be used only for
   * retrieval of existing data and clearing of data. But should not be used for storage
   * of new data. This means that the a secure storage implementation exists but for some
   * reason the usage of it might degrade user experience. An example of this is our
   * desktop app operating in its portable mode. The system API's are available to make
   * secure storage work but it makes it impossible to login on one machine, then move
   * the application to another machine and unlock there.
   *
   * If the type is `needs-configuration` then secure storage cannot be used at all. For
   * purposes of using the API this type is the same as `not-supported` but you may utilize
   * this type to add a callout somewhere in the application so that the documentation can
   * be linked to. This documentation can then help instruct the user on what to do so that
   * they can start using secure storage.
   *
   * If the type is `not-supported` then secure storage is not available and cannot be used.
   * Depending on the feature, then you may need to not allow a feature to be used or you
   * will need to fallback to using insecure, disk based storage.
   */
  abstract support$: Observable<SupportStatus>;
}

export class UnsupportedSecureStorageService implements SecureStorageService {
  constructor(reason: string) {
    this.support$ = of({
      type: "not-supported",
      reason: reason,
    } satisfies SupportStatus);
  }

  support$: Observable<SupportStatus>;
}

export class SupportedSecureStorageService implements SecureStorageService {
  constructor(storageService: AbstractStorageService) {
    this.support$ = of({
      type: "supported",
      service: storageService,
    } satisfies SupportStatus);
  }

  support$: Observable<SupportStatus>;
}
