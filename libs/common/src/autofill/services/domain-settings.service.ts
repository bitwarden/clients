// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { combineLatest, map, Observable, switchMap, shareReplay } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums/policy-type.enum";
import { getFirstPolicy } from "@bitwarden/common/admin-console/services/policy/default-policy.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";

import {
  NeverDomains,
  EquivalentDomains,
  UriMatchStrategySetting,
  UriMatchStrategy,
} from "../../models/domain/domain-service";
import { Utils } from "../../platform/misc/utils";
import {
  DOMAIN_SETTINGS_DISK,
  ActiveUserState,
  GlobalState,
  KeyDefinition,
  StateProvider,
  UserKeyDefinition,
} from "../../platform/state";
import { UserId } from "../../types/guid";
import { AutofillTargetingRulesByDomain, AutofillTargetingRules } from "../types";

const SHOW_FAVICONS = new KeyDefinition(DOMAIN_SETTINGS_DISK, "showFavicons", {
  deserializer: (value: boolean) => value ?? true,
});

// Domain exclusion list for notifications
const NEVER_DOMAINS = new KeyDefinition(DOMAIN_SETTINGS_DISK, "neverDomains", {
  deserializer: (value: NeverDomains) => value ?? null,
});

// Domain exclusion list for content script injections
const BLOCKED_INTERACTIONS_URIS = new KeyDefinition(
  DOMAIN_SETTINGS_DISK,
  "blockedInteractionsUris",
  {
    deserializer: (value: NeverDomains) => value ?? {},
  },
);

const EQUIVALENT_DOMAINS = new UserKeyDefinition(DOMAIN_SETTINGS_DISK, "equivalentDomains", {
  deserializer: (value: EquivalentDomains) => value ?? null,
  clearOn: ["logout"],
});

const DEFAULT_URI_MATCH_STRATEGY = new UserKeyDefinition(
  DOMAIN_SETTINGS_DISK,
  "defaultUriMatchStrategy",
  {
    deserializer: (value: UriMatchStrategySetting) => value ?? UriMatchStrategy.Domain,
    clearOn: [],
  },
);

const AUTOFILL_TARGETING_RULES = new UserKeyDefinition(
  DOMAIN_SETTINGS_DISK,
  "autofillTargetingRules",
  {
    deserializer: (value: AutofillTargetingRulesByDomain) => value ?? {},
    clearOn: [],
  },
);

/**
 * The Domain Settings service; provides client settings state for "active client view" URI concerns
 */
export abstract class DomainSettingsService {
  autofillTargetingRules$: Observable<AutofillTargetingRulesByDomain>;
  setAutofillTargetingRules: (newValue: AutofillTargetingRulesByDomain) => Promise<void>;
  getUrlAutofillTargetingRules$: (url: string) => Observable<AutofillTargetingRules>;

  /**
   * Indicates if the favicons for ciphers' URIs should be shown instead of a placeholder
   */
  showFavicons$: Observable<boolean>;
  setShowFavicons: (newValue: boolean) => Promise<void>;

  /**
   * User-specified URIs for which the client notifications should not appear
   */
  neverDomains$: Observable<NeverDomains>;
  setNeverDomains: (newValue: NeverDomains) => Promise<void>;

  /**
   * User-specified URIs for which client content script injections should not occur, and the state
   * of banner/notice visibility for those domains within the client
   */
  blockedInteractionsUris$: Observable<NeverDomains>;
  setBlockedInteractionsUris: (newValue: NeverDomains) => Promise<void>;

  /**
   * URIs which should be treated as equivalent to each other for various concerns (autofill, etc)
   */
  equivalentDomains$: Observable<EquivalentDomains>;
  setEquivalentDomains: (newValue: EquivalentDomains, userId: UserId) => Promise<void>;

  /**
   * User-specified default for URI-matching strategies (for example, when determining relevant
   * ciphers for an active browser tab). Can be overridden by cipher-specific settings.
   */
  defaultUriMatchStrategy$: Observable<UriMatchStrategySetting>;
  setDefaultUriMatchStrategy: (newValue: UriMatchStrategySetting) => Promise<void>;

  /**
   * Org policy value for default for URI-matching
   * strategies. Can be overridden by cipher-specific settings.
   */
  defaultUriMatchStrategyPolicy$: Observable<UriMatchStrategySetting>;

  /**
   * Resolved (concerning user setting, org policy, etc) default for URI-matching
   * strategies. Can be overridden by cipher-specific settings.
   */
  resolvedDefaultUriMatchStrategy$: Observable<UriMatchStrategySetting>;

  /**
   * Helper function for the common resolution of a given URL against equivalent domains
   */
  getUrlEquivalentDomains: (url: string) => Observable<Set<string>>;

  /** URI normalization for Autofill Targeting rules URLs to ensure state is doing safe, consistent internal comparisons */
  normalizeAutofillTargetingURI: (url: chrome.tabs.Tab["url"]) => chrome.tabs.Tab["url"] | null;
}

export class DefaultDomainSettingsService implements DomainSettingsService {
  private autofillTargetingRulesState: ActiveUserState<AutofillTargetingRulesByDomain>;
  readonly autofillTargetingRules$: Observable<AutofillTargetingRulesByDomain>;

  private showFaviconsState: GlobalState<boolean>;
  readonly showFavicons$: Observable<boolean>;

  private neverDomainsState: GlobalState<NeverDomains>;
  readonly neverDomains$: Observable<NeverDomains>;

  private blockedInteractionsUrisState: GlobalState<NeverDomains>;
  readonly blockedInteractionsUris$: Observable<NeverDomains>;

  private equivalentDomainsState: ActiveUserState<EquivalentDomains>;
  readonly equivalentDomains$: Observable<EquivalentDomains>;

  private defaultUriMatchStrategyState: ActiveUserState<UriMatchStrategySetting>;
  readonly defaultUriMatchStrategy$: Observable<UriMatchStrategySetting>;

  readonly defaultUriMatchStrategyPolicy$: Observable<UriMatchStrategySetting>;

  readonly resolvedDefaultUriMatchStrategy$: Observable<UriMatchStrategySetting>;

  constructor(
    private stateProvider: StateProvider,
    private policyService: PolicyService,
    private accountService: AccountService,
  ) {
    this.autofillTargetingRulesState = this.stateProvider.getActive(AUTOFILL_TARGETING_RULES);
    this.autofillTargetingRules$ = this.autofillTargetingRulesState.state$.pipe(
      map((x) => (x && Object.keys(x).length ? x : {})),
    );

    this.showFaviconsState = this.stateProvider.getGlobal(SHOW_FAVICONS);
    this.showFavicons$ = this.showFaviconsState.state$.pipe(map((x) => x ?? true));

    this.neverDomainsState = this.stateProvider.getGlobal(NEVER_DOMAINS);
    this.neverDomains$ = this.neverDomainsState.state$.pipe(map((x) => x ?? null));

    // Needs to be global to prevent pre-login injections
    this.blockedInteractionsUrisState = this.stateProvider.getGlobal(BLOCKED_INTERACTIONS_URIS);
    this.blockedInteractionsUris$ = this.blockedInteractionsUrisState.state$.pipe(
      map((x) => x ?? ({} as NeverDomains)),
    );

    this.equivalentDomainsState = this.stateProvider.getActive(EQUIVALENT_DOMAINS);
    this.equivalentDomains$ = this.equivalentDomainsState.state$.pipe(map((x) => x ?? null));

    this.defaultUriMatchStrategyState = this.stateProvider.getActive(DEFAULT_URI_MATCH_STRATEGY);
    this.defaultUriMatchStrategy$ = this.defaultUriMatchStrategyState.state$.pipe(
      map((x) => x ?? UriMatchStrategy.Domain),
    );

    this.defaultUriMatchStrategyPolicy$ = this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) =>
        this.policyService.policiesByType$(PolicyType.UriMatchDefaults, userId),
      ),
      getFirstPolicy,
      map((policy) => {
        if (!policy?.enabled || policy?.data == null) {
          return null;
        }
        const data = policy.data?.defaultUriMatchStrategy;
        // Validate that data is a valid UriMatchStrategy value
        return Object.values(UriMatchStrategy).includes(data) ? data : null;
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.resolvedDefaultUriMatchStrategy$ = combineLatest([
      this.defaultUriMatchStrategy$,
      this.defaultUriMatchStrategyPolicy$,
    ]).pipe(
      map(([userSettingValue, policySettingValue]) => policySettingValue || userSettingValue),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  async setAutofillTargetingRules(newValue: AutofillTargetingRulesByDomain): Promise<void> {
    await this.autofillTargetingRulesState.update(() => {
      const validatedNewValue = Object.keys(newValue || {}).reduce((updatingValue, valueKey) => {
        const normalizedURI = this.normalizeAutofillTargetingURI(valueKey);

        if (normalizedURI) {
          return { ...updatingValue, [normalizedURI]: newValue[valueKey] };
        }

        return updatingValue;
      }, {});

      return validatedNewValue;
    });
  }

  async setShowFavicons(newValue: boolean): Promise<void> {
    await this.showFaviconsState.update(() => newValue);
  }

  async setNeverDomains(newValue: NeverDomains): Promise<void> {
    await this.neverDomainsState.update(() => newValue);
  }

  async setBlockedInteractionsUris(newValue: NeverDomains): Promise<void> {
    await this.blockedInteractionsUrisState.update(() => newValue);
  }

  async setEquivalentDomains(newValue: EquivalentDomains, userId: UserId): Promise<void> {
    await this.stateProvider.getUser(userId, EQUIVALENT_DOMAINS).update(() => newValue);
  }

  async setDefaultUriMatchStrategy(newValue: UriMatchStrategySetting): Promise<void> {
    await this.defaultUriMatchStrategyState.update(() => newValue);
  }

  getUrlEquivalentDomains(url: string): Observable<Set<string>> {
    const domains$ = this.equivalentDomains$.pipe(
      map((equivalentDomains) => {
        const domain = Utils.getDomain(url);
        if (domain == null || equivalentDomains == null) {
          return new Set() as Set<string>;
        }

        const equivalents = equivalentDomains.filter((ed) => ed.includes(domain)).flat();

        return new Set(equivalents);
      }),
    );

    return domains$;
  }

  getUrlAutofillTargetingRules$(url: chrome.tabs.Tab["url"]): Observable<AutofillTargetingRules> {
    const normalizedURI = this.normalizeAutofillTargetingURI(url);

    return this.autofillTargetingRules$.pipe(
      map((autofillTargetingRules) => {
        if (!normalizedURI) {
          return {};
        }

        return autofillTargetingRules?.[normalizedURI] || {};
      }),
    );
  }

  normalizeAutofillTargetingURI(url: chrome.tabs.Tab["url"]) {
    if (!Utils.isNullOrWhitespace(url)) {
      const uriParts = Utils.getUrl(url);
      const validatedHostname = Utils.getHostname(url);

      // Prevent directory traversal from malicious paths
      const pathParts = uriParts.pathname.split("?");
      const normalizedURI =
        uriParts.protocol + "//" + validatedHostname + Utils.normalizePath(pathParts[0]);

      return normalizedURI;
    }

    return null;
  }
}
