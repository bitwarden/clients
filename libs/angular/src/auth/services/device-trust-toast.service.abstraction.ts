import { Observable } from "rxjs";

export abstract class DeviceTrustToastService {
  /**
   * An observable pipeline that observes any cross-application toast messages
   * that need to be shown as part of the trusted device encryption (TDE) process.
   */
  abstract setupListeners$: Observable<void>;
}
