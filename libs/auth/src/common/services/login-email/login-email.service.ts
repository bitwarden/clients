import { Observable } from "rxjs";

import {
  GlobalState,
  KeyDefinition,
  LOGIN_EMAIL_DISK,
  StateProvider,
} from "../../../../../common/src/platform/state";
import { LoginEmailServiceAbstraction } from "../../abstractions/login-email.service";

const STORED_EMAIL = new KeyDefinition<string>(LOGIN_EMAIL_DISK, "storedEmail", {
  deserializer: (value: string) => value,
});

export class LoginEmailService implements LoginEmailServiceAbstraction {
  private email: string;
  private rememberEmail: boolean;

  private readonly storedEmailState: GlobalState<string>;
  storedEmail$: Observable<string>;

  constructor(private stateProvider: StateProvider) {
    this.storedEmailState = this.stateProvider.getGlobal(STORED_EMAIL);
    this.storedEmail$ = this.storedEmailState.state$;
  }

  getEmail() {
    return this.email;
  }

  setEmail(email: string) {
    this.email = email;
  }

  getRememberEmail() {
    return this.rememberEmail;
  }

  setRememberEmail(value: boolean) {
    this.rememberEmail = value;
  }

  clearValues() {
    this.email = null;
    this.rememberEmail = null;
  }

  async saveEmailSettings() {
    await this.storedEmailState.update(() => (this.rememberEmail ? this.email : null));
    this.clearValues();
  }
}
