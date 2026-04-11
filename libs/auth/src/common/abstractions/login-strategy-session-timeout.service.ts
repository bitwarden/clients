import { Observable } from "rxjs";

export abstract class LoginStrategySessionTimeoutServiceAbstraction {
  /**
   * Registers the session timeout task handler with the task scheduler.
   * Must be called once at startup in each client context where the alarm can fire
   * (e.g. browser background service worker, web/desktop Angular init).
   *
   * When the alarm fires, the handler broadcasts LOGIN_SESSION_EXPIRED and
   * clears the mid-auth cache via LoginStrategyCacheService.
   */
  abstract registerSessionTimeoutTask(): void;
  /** Emits each time the login strategy session expires. */
  abstract loginSessionTimeout$: Observable<void>;
  /** Schedules the session timeout alarm and persists the expiration timestamp. */
  abstract startSessionTimeout(): Promise<void>;
  /** Cancels the in-flight timer and clears the persisted expiration timestamp. */
  abstract cancelSessionTimeout(): Promise<void>;
}
