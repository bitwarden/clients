import { firstValueFrom, map, Observable } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";

import {
  GlobalState,
  KeyDefinition,
  SingleUserState,
  SSO_DISK,
  SSO_DISK_LOCAL,
  StateProvider,
  UserKeyDefinition,
} from "../../platform/state";
import { SsoLoginServiceAbstraction } from "../abstractions/sso-login.service.abstraction";

/**
 * Uses disk storage so that the code verifier can be persisted across sso redirects.
 */
export const CODE_VERIFIER = new KeyDefinition<string>(SSO_DISK, "ssoCodeVerifier", {
  deserializer: (codeVerifier) => codeVerifier,
});

/**
 * Uses disk storage so that the sso state can be persisted across sso redirects.
 */
export const SSO_STATE = new KeyDefinition<string>(SSO_DISK, "ssoState", {
  deserializer: (state) => state,
});

/**
 * Uses disk storage so that the organization sso identifier can be persisted across sso redirects.
 */
export const USER_ORGANIZATION_SSO_IDENTIFIER = new UserKeyDefinition<string>(
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
export const GLOBAL_ORGANIZATION_SSO_IDENTIFIER = new KeyDefinition<string>(
  SSO_DISK,
  "organizationSsoIdentifier",
  {
    deserializer: (organizationIdentifier) => organizationIdentifier,
  },
);

/**
 * Uses disk storage so that the user's email can be persisted across sso redirects.
 */
export const SSO_EMAIL = new KeyDefinition<string>(SSO_DISK, "ssoEmail", {
  deserializer: (state) => state,
});

/**
 * A cache list of user emails for whom the `PolicyType.RequireSso` policy is applied (that is, a list
 * of users who are required to authenticate via SSO only). The cache lives on the current device only.
 */
export const SSO_REQUIRED_CACHE = new KeyDefinition<string[]>(SSO_DISK_LOCAL, "ssoRequiredCache", {
  deserializer: (ssoRequiredCache) => ssoRequiredCache,
});

export class SsoLoginService implements SsoLoginServiceAbstraction {
  private codeVerifierState: GlobalState<string>;
  private ssoState: GlobalState<string>;
  private orgSsoIdentifierState: GlobalState<string>;
  private ssoEmailState: GlobalState<string>;
  private ssoRequiredCacheState: GlobalState<string[]>;

  ssoRequiredCache$: Observable<Set<string> | null>;

  constructor(
    private stateProvider: StateProvider,
    private logService: LogService,
    private policyService: PolicyService,
  ) {
    this.codeVerifierState = this.stateProvider.getGlobal(CODE_VERIFIER);
    this.ssoState = this.stateProvider.getGlobal(SSO_STATE);
    this.orgSsoIdentifierState = this.stateProvider.getGlobal(GLOBAL_ORGANIZATION_SSO_IDENTIFIER);
    this.ssoEmailState = this.stateProvider.getGlobal(SSO_EMAIL);
    this.ssoRequiredCacheState = this.stateProvider.getGlobal(SSO_REQUIRED_CACHE);

    this.ssoRequiredCache$ = this.ssoRequiredCacheState.state$.pipe(map((cache) => new Set(cache)));
  }

  getCodeVerifier(): Promise<string | null> {
    return firstValueFrom(this.codeVerifierState.state$);
  }

  async setCodeVerifier(codeVerifier: string): Promise<void> {
    await this.codeVerifierState.update((_) => codeVerifier);
  }

  getSsoState(): Promise<string | null> {
    return firstValueFrom(this.ssoState.state$);
  }

  async setSsoState(ssoState: string): Promise<void> {
    await this.ssoState.update((_) => ssoState);
  }

  getOrganizationSsoIdentifier(): Promise<string | null> {
    return firstValueFrom(this.orgSsoIdentifierState.state$);
  }

  async setOrganizationSsoIdentifier(organizationIdentifier: string): Promise<void> {
    await this.orgSsoIdentifierState.update((_) => organizationIdentifier);
  }

  getSsoEmail(): Promise<string | null> {
    return firstValueFrom(this.ssoEmailState.state$);
  }

  async setSsoEmail(email: string): Promise<void> {
    await this.ssoEmailState.update((_) => email);
  }

  getActiveUserOrganizationSsoIdentifier(userId: UserId): Promise<string | null> {
    return firstValueFrom(this.userOrgSsoIdentifierState(userId).state$);
  }

  async setActiveUserOrganizationSsoIdentifier(
    organizationIdentifier: string,
    userId: UserId | undefined,
  ): Promise<void> {
    if (userId === undefined) {
      this.logService.error(
        "Tried to set a user organization sso identifier with an undefined user id.",
      );
      return;
    }
    await this.userOrgSsoIdentifierState(userId).update((_) => organizationIdentifier);
  }

  private userOrgSsoIdentifierState(userId: UserId): SingleUserState<string> {
    return this.stateProvider.getUser(userId, USER_ORGANIZATION_SSO_IDENTIFIER);
  }

  /**
   * Add an email to the cached list of emails that must authenticate via SSO.
   */
  private async addToSsoRequiredCache(email: string): Promise<void> {
    await this.ssoRequiredCacheState.update(
      (cache) => (cache == null ? [email] : [...cache, email]),
      {
        shouldUpdate: (cache) => {
          if (cache == null) {
            return true;
          }
          return !cache.includes(email);
        },
      },
    );
  }

  async removeFromSsoRequiredCacheIfPresent(email: string): Promise<void> {
    await this.ssoRequiredCacheState.update(
      (cache) => cache?.filter((cachedEmail) => cachedEmail !== email) ?? cache,
      {
        shouldUpdate: (cache) => {
          if (cache == null) {
            return false;
          }
          return cache.includes(email);
        },
      },
    );
  }

  async updateSsoRequiredCache(ssoLoginEmail: string, userId: UserId): Promise<void> {
    const ssoRequired = await firstValueFrom(
      this.policyService.policyAppliesToUser$(PolicyType.RequireSso, userId),
    );

    if (ssoRequired) {
      await this.addToSsoRequiredCache(ssoLoginEmail.toLowerCase());
    } else {
      /**
       * If user is not required to authenticate via SSO, remove email from the cache
       * list (if it was on the list). This is necessary because the user may have been
       * required to authenticate via SSO at some point in the past, but now their org
       * no longer requires SSO authenticaiton.
       */
      await this.removeFromSsoRequiredCacheIfPresent(ssoLoginEmail.toLowerCase());
    }

    // Clear the SSO email
    await this.setSsoEmail(null);
  }
}
