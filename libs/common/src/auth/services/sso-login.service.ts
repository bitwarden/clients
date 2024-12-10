// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom } from "rxjs";

import {
  ActiveUserState,
  GlobalState,
  KeyDefinition,
  SSO_DISK,
  StateProvider,
  UserKeyDefinition,
} from "../../platform/state";
import { SsoLoginServiceAbstraction } from "../abstractions/sso-login.service.abstraction";

/**
 * Uses disk storage so that the code verifier can be persisted across sso redirects.
 */
const CODE_VERIFIER = new KeyDefinition<string>(SSO_DISK, "ssoCodeVerifier", {
  deserializer: (codeVerifier) => codeVerifier,
});

/**
 * Uses disk storage so that the sso state can be persisted across sso redirects.
 */
const SSO_STATE = new KeyDefinition<string>(SSO_DISK, "ssoState", {
  deserializer: (state) => state,
});

/**
 * Uses disk storage so that the organization sso identifier can be persisted across sso redirects.
 */
const USER_ORGANIZATION_SSO_IDENTIFIER = new UserKeyDefinition<string>(
  SSO_DISK,
  "organizationSsoIdentifier",
  {
    deserializer: (organizationIdentifier) => organizationIdentifier,
    clearOn: ["logout"], // Used for login, so not needed past logout
  },
);

/**
 * Uses disk storage so that the organization sso identifier can be persisted across sso redirects.
 */
const GLOBAL_ORGANIZATION_SSO_IDENTIFIER = new KeyDefinition<string>(
  SSO_DISK,
  "organizationSsoIdentifier",
  {
    deserializer: (organizationIdentifier) => organizationIdentifier,
  },
);

/**
 * Uses disk storage so that the user's email can be persisted across sso redirects.
 */
const SSO_EMAIL = new KeyDefinition<string>(SSO_DISK, "ssoEmail", {
  deserializer: (state) => state,
});

export class SsoLoginService implements SsoLoginServiceAbstraction {
  private codeVerifierState: GlobalState<string>;
  private ssoState: GlobalState<string>;
  private orgSsoIdentifierState: GlobalState<string>;
  private ssoEmailState: GlobalState<string>;
  private activeUserOrgSsoIdentifierState: ActiveUserState<string>;

  constructor(private stateProvider: StateProvider) {
    this.codeVerifierState = this.stateProvider.getGlobal(CODE_VERIFIER);
    this.ssoState = this.stateProvider.getGlobal(SSO_STATE);
    this.orgSsoIdentifierState = this.stateProvider.getGlobal(GLOBAL_ORGANIZATION_SSO_IDENTIFIER);
    this.ssoEmailState = this.stateProvider.getGlobal(SSO_EMAIL);
    this.activeUserOrgSsoIdentifierState = this.stateProvider.getActive(
      USER_ORGANIZATION_SSO_IDENTIFIER,
    );
  }

  getCodeVerifier(): Promise<string> {
    return firstValueFrom(this.codeVerifierState.state$);
  }

  async setCodeVerifier(codeVerifier: string): Promise<void> {
    await this.codeVerifierState.update((_) => codeVerifier);
  }

  getSsoState(): Promise<string> {
    return firstValueFrom(this.ssoState.state$);
  }

  async setSsoState(ssoState: string): Promise<void> {
    await this.ssoState.update((_) => ssoState);
  }

  getOrganizationSsoIdentifier(): Promise<string> {
    return firstValueFrom(this.orgSsoIdentifierState.state$);
  }

  async setOrganizationSsoIdentifier(organizationIdentifier: string): Promise<void> {
    await this.orgSsoIdentifierState.update((_) => organizationIdentifier);
  }

  getSsoEmail(): Promise<string> {
    return firstValueFrom(this.ssoEmailState.state$);
  }

  async setSsoEmail(email: string): Promise<void> {
    await this.ssoEmailState.update((_) => email);
  }

  getActiveUserOrganizationSsoIdentifier(): Promise<string> {
    return firstValueFrom(this.activeUserOrgSsoIdentifierState.state$);
  }

  async setActiveUserOrganizationSsoIdentifier(organizationIdentifier: string): Promise<void> {
    await this.activeUserOrgSsoIdentifierState.update((_) => organizationIdentifier);
  }
}
