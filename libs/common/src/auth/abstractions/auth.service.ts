import { Observable } from "rxjs";

import { AuthenticationStatus } from "../enums/authentication-status";

export abstract class AuthService {
  /** Authentication status for the active user */
  abstract activeAccountStatus$: Observable<AuthenticationStatus>;
  /** @deprecated use {@link activeAccountStatus$} instead */
  abstract getAuthStatus: (userId?: string) => Promise<AuthenticationStatus>;
  abstract logOut: (callback: () => void) => void;
}
