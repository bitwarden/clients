// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { combineLatest, firstValueFrom, map, Observable, switchMap, shareReplay } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums/policy-type.enum";
import { getFirstPolicy } from "@bitwarden/common/admin-console/services/policy/default-policy.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

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
import { FormContent, Pathname, TargetingRulesByDomain } from "../types";

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

const TARGETING_RULES = new KeyDefinition<TargetingRulesByDomain>(
  DOMAIN_SETTINGS_DISK,
  "fillAssistTargetingRules",
  {
    deserializer: (value: TargetingRulesByDomain) => value ?? null,
  },
);

const ENABLE_FILL_ASSIST = new KeyDefinition(DOMAIN_SETTINGS_DISK, "enableFillAssist", {
  deserializer: (value: boolean) => value ?? false,
});

/**
 * The Domain Settings service; provides client settings state for "active client view" URI concerns
 */
export abstract class DomainSettingsService {
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

  /**
   * User-controlled setting for whether or not fill assist targeting rules
   * should be used
   */
  enableFillAssist$: Observable<boolean>;
  setEnableFillAssist: (newValue: boolean) => Promise<void>;

  /**
   * Observable of all cached autofill targeting rules, keyed by normalized URL
   */
  targetingRules$: Observable<TargetingRulesByDomain | null>;

  /**
   * Update the cached targeting rules
   */
  setTargetingRules: (rules: TargetingRulesByDomain) => Promise<void>;

  /**
   * Look up targeting rules for a given URL. Checks pathname-specific
   * rules first, then falls back to hostname-level forms.
   *
   * @returns `FormContent[]` with entries for targeted fill,
   *          `[]` (empty) if the URL is blocklisted (suppress autofill),
   *          `null` if no rules exist (fall through to heuristics)
   */
  getTargetingRulesForUrl: (url: string) => Promise<FormContent[] | null>;
}

export class DefaultDomainSettingsService implements DomainSettingsService {
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

  private enableFillAssistState: GlobalState<boolean>;
  readonly enableFillAssist$: Observable<boolean>;

  private targetingRulesState: GlobalState<TargetingRulesByDomain>;
  readonly targetingRules$: Observable<TargetingRulesByDomain | null>;

  constructor(
    private stateProvider: StateProvider,
    private policyService: PolicyService,
    private accountService: AccountService,
    private configService: ConfigService,
  ) {
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

    this.enableFillAssistState = this.stateProvider.getGlobal(ENABLE_FILL_ASSIST);
    this.enableFillAssist$ = this.enableFillAssistState.state$.pipe(map((x) => x ?? false));

    this.targetingRulesState = this.stateProvider.getGlobal(TARGETING_RULES);
    this.targetingRules$ = this.targetingRulesState.state$.pipe(map((x) => x ?? null));

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
        const data = policy.data?.uriMatchDetection;
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

  async setEnableFillAssist(newValue: boolean): Promise<void> {
    await this.enableFillAssistState.update(() => newValue);
  }

  async setTargetingRules(rules: TargetingRulesByDomain): Promise<void> {
    await this.targetingRulesState.update(() => rules);
  }

  async getTargetingRulesForUrl(url: URL["href"]): Promise<FormContent[] | null> {
    const fillAssistFeatureEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.FillAssistTargetingRules,
    );
    if (!fillAssistFeatureEnabled) {
      return null;
    }

    const enableFillAssist = await firstValueFrom(this.enableFillAssist$);
    if (!enableFillAssist) {
      return null;
    }

    // Fill Assist will not be applied when the user is logged out
    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
    if (!activeAccount) {
      return null;
    }

    const rules = await firstValueFrom(this.targetingRules$);
    if (!rules) {
      return null;
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }

    let hostRules = rules[parsed.host];

    // www subdomain equivalence: if no entry for www.example.com, try example.com
    if (hostRules === undefined && parsed.host.startsWith("www.")) {
      hostRules = rules[parsed.host.slice(4)];
    }

    // No rules for this host; fall through to heuristics
    if (hostRules === undefined) {
      return null;
    }

    // Hostname blocklisted (null or empty): suppress autofill on all paths
    if (hostRules === null || (!hostRules.forms?.length && !hostRules.pathnames)) {
      return [];
    }

    // Check for pathname-specific rules
    // Fall back to root path `/` to enable checking cases where
    // a rule signals a form that is ONLY on the domain's root page
    const pathname = (parsed.pathname.replace(/\/+$/, "") || "/") as Pathname;
    if (hostRules.pathnames != null && pathname in hostRules.pathnames) {
      const pathnameEntry = hostRules.pathnames[pathname];

      // Pathname blocklisted (null/undefined/empty): suppress autofill on this path
      if (!pathnameEntry?.forms?.length) {
        return [];
      }

      return pathnameEntry.forms;
    }

    // No pathname-specific rule; fall back to hostname-level forms
    return hostRules.forms?.length ? hostRules.forms : null;
  }
}
