import { Observable } from "rxjs";

export abstract class LoginStrategySessionTimeoutService {
  /** Emits each time the login strategy session expires. */
  abstract loginSessionTimeout$: Observable<void>;
  /** Schedules the session timeout alarm and persists the expiration timestamp. */
  abstract startSessionTimeout(): Promise<void>;
  /** Cancels the in-flight timer and clears the persisted expiration timestamp. */
  abstract cancelSessionTimeout(): Promise<void>;
}
