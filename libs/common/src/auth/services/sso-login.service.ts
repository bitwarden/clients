import { firstValueFrom, Observable } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
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
import {
  SsoLoginServiceAbstraction,
  SsoRequiredCacheEntry,
} from "../abstractions/sso-login.service.abstraction";

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
 * A cache list of users for whom the `PolicyType.RequireSso` policy is applied (that is, a list
 * of users who are required to authenticate via SSO only). The cache lives on the current device only.
 */
export const SSO_REQUIRED_CACHE = new KeyDefinition<SsoRequiredCacheEntry[]>(
  SSO_DISK_LOCAL,
  "ssoRequiredCache",
  {
    deserializer: (cache) => {
      if (!Array.isArray(cache) || cache.length === 0) {
        return cache;
      }

      // Old cache format was just an array of emails (string[]). Clear it since we cannot use
      // that format to infer the environment. New cache format uses SsoRequiredCacheEntry[].
      if (typeof cache[0] === "string") {
        return null;
      }

      return cache;
    },
  },
);

export class SsoLoginService implements SsoLoginServiceAbstraction {
  private codeVerifierState: GlobalState<string>;
  private ssoState: GlobalState<string>;
  private orgSsoIdentifierState: GlobalState<string>;
  private ssoEmailState: GlobalState<string>;
  private ssoRequiredCacheState: GlobalState<SsoRequiredCacheEntry[]>;

  ssoRequiredCache$: Observable<SsoRequiredCacheEntry[] | null>;

  constructor(
    private stateProvider: StateProvider,
    private logService: LogService,
    private policyService: PolicyService,
    private environmentService: EnvironmentService,
  ) {
    this.codeVerifierState = this.stateProvider.getGlobal(CODE_VERIFIER);
    this.ssoState = this.stateProvider.getGlobal(SSO_STATE);
    this.orgSsoIdentifierState = this.stateProvider.getGlobal(GLOBAL_ORGANIZATION_SSO_IDENTIFIER);
    this.ssoEmailState = this.stateProvider.getGlobal(SSO_EMAIL);
    this.ssoRequiredCacheState = this.stateProvider.getGlobal(SSO_REQUIRED_CACHE);

    this.ssoRequiredCache$ = this.ssoRequiredCacheState.state$;
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

  async clearSsoEmail(): Promise<void> {
    await this.ssoEmailState.update((_) => null);
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
   * Add an entry to a cache list of users who must authenticate via SSO.
   */
  private async addToSsoRequiredCache(email: string, webVaultUrl: string): Promise<void> {
    const newEntry: SsoRequiredCacheEntry = { email: email.toLowerCase(), webVaultUrl };

    await this.ssoRequiredCacheState.update(
      (cache) => (cache == null ? [newEntry] : [...cache, newEntry]),
      {
        shouldUpdate: (cache) => {
          // Always update if cache does not yet exist
          if (cache == null) {
            return true;
          }

          // Don't update if entry is already in the cache
          return !cache.some(
            (e) => e.email === newEntry.email && e.webVaultUrl === newEntry.webVaultUrl,
          );
        },
      },
    );
  }

  async removeFromSsoRequiredCacheIfPresent(email: string, webVaultUrl: string): Promise<void> {
    const entryToRemove: SsoRequiredCacheEntry = { email: email.toLowerCase(), webVaultUrl };

    await this.ssoRequiredCacheState.update(
      (cache) =>
        cache?.filter(
          (e) => !(e.email === entryToRemove.email && e.webVaultUrl === entryToRemove.webVaultUrl),
        ) ?? cache,
      {
        shouldUpdate: (cache) => {
          // Don't update if cache does not exist
          if (cache == null) {
            return false;
          }

          // Only update if entry is found in the cache
          return cache.some(
            (e) => e.email === entryToRemove.email && e.webVaultUrl === entryToRemove.webVaultUrl,
          );
        },
      },
    );
  }

  async updateSsoRequiredCache(email: string, userId: UserId): Promise<void> {
    const ssoRequired = await firstValueFrom(
      this.policyService.policyAppliesToUser$(PolicyType.RequireSso, userId),
    );

    const env = await firstValueFrom(this.environmentService.getEnvironment$(userId));
    const webVaultUrl = env.getWebVaultUrl();

    if (ssoRequired) {
      await this.addToSsoRequiredCache(email, webVaultUrl);
    } else {
      /**
       * If user is not required to authenticate via SSO, remove their entry from the cache
       * list (if it was on the list). This is necessary because the user may have been
       * required to authenticate via SSO at some point in the past, but now their org
       * no longer requires SSO authenticaiton.
       */
      await this.removeFromSsoRequiredCacheIfPresent(email, webVaultUrl);
    }
  }
}
