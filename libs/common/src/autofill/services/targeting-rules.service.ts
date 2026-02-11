// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, map, Observable } from "rxjs";

import {
  GlobalState,
  KeyDefinition,
  StateProvider,
  TARGETING_RULES_DISK,
} from "../../platform/state";
import { AutofillTargetingRules, AutofillTargetingRulesByDomain } from "../types";

const TARGETING_RULES = new KeyDefinition<AutofillTargetingRulesByDomain>(
  TARGETING_RULES_DISK,
  "rules",
  {
    deserializer: (value: AutofillTargetingRulesByDomain) => value ?? null,
  },
);

export abstract class TargetingRulesService {
  /** Observable of all cached targeting rules */
  targetingRules$: Observable<AutofillTargetingRulesByDomain | null>;

  /** Update the cached targeting rules (called by the fetch/sync mechanism) */
  setTargetingRules: (rules: AutofillTargetingRulesByDomain) => Promise<void>;

  /** Look up targeting rules for a given URL, returning null if none exist */
  getTargetingRulesForUrl: (url: string) => Promise<AutofillTargetingRules | null>;
}

export class DefaultTargetingRulesService implements TargetingRulesService {
  private targetingRulesState: GlobalState<AutofillTargetingRulesByDomain>;
  readonly targetingRules$: Observable<AutofillTargetingRulesByDomain | null>;

  constructor(private stateProvider: StateProvider) {
    this.targetingRulesState = this.stateProvider.getGlobal(TARGETING_RULES);
    this.targetingRules$ = this.targetingRulesState.state$.pipe(map((x) => x ?? null));
  }

  async setTargetingRules(rules: AutofillTargetingRulesByDomain): Promise<void> {
    await this.targetingRulesState.update(() => rules);
  }

  async getTargetingRulesForUrl(url: URL["href"]): Promise<AutofillTargetingRules | null> {
    const rules = await firstValueFrom(this.targetingRules$);
    if (!rules) {
      return null;
    }

    const normalizedURL = this.normalizeUrl(url);
    if (!normalizedURL) {
      return null;
    }

    // Exact match first (protocol + hostname + path)
    if (rules[normalizedURL]) {
      return rules[normalizedURL];
    }

    // Fallback to hostname-only match
    const hostnameOnly = new URL(url).hostname;
    if (hostnameOnly && rules[hostnameOnly]) {
      return rules[hostnameOnly];
    }

    return null;
  }

  private normalizeUrl(url: string): string | null {
    if (!url) {
      return null;
    }

    try {
      const parsed = new URL(url);
      // remove trailing slash
      const path = parsed.pathname.replace(/\/+$/, "") || "";
      return `${parsed.hostname}${path}`;
    } catch {
      return null;
    }
  }
}
