import { firstValueFrom, Observable } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";

import { GlobalState, SingleUserState, StateProvider } from "../../../platform/state";
import {
  SsoLoginServiceAbstraction,
  SsoRequiredCacheEntry,
} from "../../abstractions/sso-login.service.abstraction";

import {
  CODE_VERIFIER,
  GLOBAL_ORGANIZATION_SSO_IDENTIFIER,
  SSO_EMAIL,
  SSO_REQUIRED_CACHE,
  SSO_STATE,
  USER_ORGANIZATION_SSO_IDENTIFIER,
} from "./sso-login.state";

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
  private async addToSsoRequiredCache(email: string, userId: UserId): Promise<void> {
    const newEntry = await this.makeEntry(email, userId);

    await this.ssoRequiredCacheState.update(
      (cache) => (cache == null ? [newEntry] : [...cache, newEntry]),
      {
        shouldUpdate: (cache) => {
          // Always update if cache does not yet exist
          if (cache == null) {
            return true;
          }

          // Don't update if entry is already in the cache
          return !cache.some((e) => this.entriesMatch(e, newEntry));
        },
      },
    );
  }

  async removeFromSsoRequiredCacheIfPresent(email: string, userId: UserId): Promise<void> {
    const entryToRemove = await this.makeEntry(email, userId);

    await this.ssoRequiredCacheState.update(
      (cache) => cache?.filter((e) => !this.entriesMatch(e, entryToRemove)) ?? cache,
      {
        shouldUpdate: (cache) => {
          // Don't update if cache does not exist
          if (cache == null) {
            return false;
          }

          // Only update if entry is found in the cache
          return cache.some((e) => this.entriesMatch(e, entryToRemove));
        },
      },
    );
  }

  async updateSsoRequiredCache(email: string, userId: UserId): Promise<void> {
    const ssoRequired = await firstValueFrom(
      this.policyService.policyAppliesToUser$(PolicyType.RequireSso, userId),
    );

    if (ssoRequired) {
      await this.addToSsoRequiredCache(email, userId);
    } else {
      /**
       * If user is not required to authenticate via SSO, remove their entry from the cache
       * list (if it was on the list). This is necessary because the user may have been
       * required to authenticate via SSO at some point in the past, but now their org
       * no longer requires SSO authentication.
       */
      await this.removeFromSsoRequiredCacheIfPresent(email, userId);
    }
  }

  /**
   * Makes an `SsoRequiredCacheEntry` object based on the user's email and resolved webVaultUrl
   */
  private async makeEntry(email: string, userId: UserId): Promise<SsoRequiredCacheEntry> {
    const env = await firstValueFrom(this.environmentService.getEnvironment$(userId));
    const webVaultUrl = env.getWebVaultUrl();

    return { email: email.toLowerCase(), webVaultUrl };
  }

  /**
   * Determines if two `SsoRequiredCacheEntry` objects have matching values
   */
  private entriesMatch(a: SsoRequiredCacheEntry, b: SsoRequiredCacheEntry): boolean {
    return a.email === b.email && a.webVaultUrl === b.webVaultUrl;
  }
}
