import { Injectable, LOCALE_ID, inject } from "@angular/core";
import { BehaviorSubject, Observable, combineLatest, firstValueFrom, map } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import {
  AccessCondition,
  AccessRuleResponse,
  PamApiService,
  accessRuleToRequest,
  accessRuleWindow,
  formatRelativeTime,
} from "@bitwarden/bit-pam";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { BitwardenIcon } from "@bitwarden/components";

/** A condition rendered as an icon + i18n label key. */
export type ConditionBadge = {
  icon: BitwardenIcon;
  labelKey: string;
};

/**
 * A flattened, presentation-ready view of an {@link AccessRuleResponse}. The derived
 * `name`, `status`, and `revisionDate` properties are what {@link TableDataSource}'s
 * default accessor sorts on, so each sortable column maps to a property here.
 */
export type AccessRuleRow = {
  id: string;
  rule: AccessRuleResponse;
  name: string;
  enabled: boolean;
  status: string;
  /** Epoch milliseconds, so the "Last modified" column sorts chronologically. */
  revisionDate: number;
  collectionNames: string[];
  conditionBadges: ConditionBadge[];
  accessWindow: string | null;
  lastModified: string;
};

/**
 * Page-level data service for the access rules table: owns the rule list and the
 * collection-name lookup, loads them, projects rules into presentation rows, and
 * performs the CRUD mutations (enable/disable, delete, and their bulk variants).
 *
 * Provided at the component level so each `AccessRulesComponent` gets its own
 * instance. View concerns (toasts, confirm dialogs, selection, routing) stay in
 * the component; this service just owns state and the API round-trips.
 */
@Injectable()
export class AccessRulesService {
  private readonly pamApi = inject(PamApiService);
  private readonly accountService = inject(AccountService);
  private readonly collectionAdminService = inject(CollectionAdminService);
  private readonly i18nService = inject(I18nService);
  private readonly locale = inject(LOCALE_ID);

  private readonly relativeTimeFormat = new Intl.RelativeTimeFormat(this.locale, {
    numeric: "always",
    style: "narrow",
  });

  /** Set by {@link load}; the org all subsequent mutations target. */
  private organizationId: OrganizationId | null = null;

  private readonly _rules$ = new BehaviorSubject<AccessRuleResponse[]>([]);
  private readonly _collectionNameById$ = new BehaviorSubject<Map<string, string>>(new Map());
  private readonly _loading$ = new BehaviorSubject<boolean>(true);

  readonly rules$: Observable<AccessRuleResponse[]> = this._rules$.asObservable();
  readonly collectionNameById$: Observable<Map<string, string>> =
    this._collectionNameById$.asObservable();
  readonly loading$: Observable<boolean> = this._loading$.asObservable();

  /** Rules projected into presentation rows, kept in step with the loaded collections. */
  readonly rows$: Observable<AccessRuleRow[]> = combineLatest([
    this._rules$,
    this._collectionNameById$,
  ]).pipe(map(([rules, names]) => this.buildRows(rules, names)));

  /** Fetch the org's rules and collection names, replacing local state. */
  async load(organizationId: OrganizationId): Promise<void> {
    this.organizationId = organizationId;
    this._loading$.next(true);
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const [rulesResponse, collections] = await Promise.all([
        this.pamApi.listAccessRules(organizationId),
        firstValueFrom(this.collectionAdminService.collectionAdminViews$(organizationId, userId)),
      ]);
      this._collectionNameById$.next(new Map(collections.map((c) => [c.id, c.name])));
      this._rules$.next(rulesResponse.data);
    } finally {
      this._loading$.next(false);
    }
  }

  /** The currently-loaded rule with the given id, if any. */
  getRule(id: string): AccessRuleResponse | undefined {
    return this._rules$.value.find((r) => r.id === id);
  }

  /** Toggle a single rule's enabled flag, patching local state with the result. */
  async setEnabled(rule: AccessRuleResponse, enabled: boolean): Promise<void> {
    const updated = await this.pamApi.updateAccessRule(
      this.requireOrganizationId(),
      rule.id,
      accessRuleToRequest(rule, enabled),
    );
    this._rules$.next(this._rules$.value.map((r) => (r.id === rule.id ? updated : r)));
  }

  /**
   * Enable/disable many rules at once, skipping rules already in the target state.
   * Returns the number of rules actually changed (0 when none needed updating).
   */
  async setManyEnabled(rules: AccessRuleResponse[], enabled: boolean): Promise<number> {
    const targets = rules.filter((r) => r.enabled !== enabled);
    if (targets.length === 0) {
      return 0;
    }
    const updated = await Promise.all(
      targets.map((rule) =>
        this.pamApi.updateAccessRule(
          this.requireOrganizationId(),
          rule.id,
          accessRuleToRequest(rule, enabled),
        ),
      ),
    );
    const byId = new Map(updated.map((r) => [r.id, r]));
    this._rules$.next(this._rules$.value.map((r) => byId.get(r.id) ?? r));
    return updated.length;
  }

  /** Delete a single rule, dropping it from local state. */
  async delete(rule: AccessRuleResponse): Promise<void> {
    await this.pamApi.deleteAccessRule(this.requireOrganizationId(), rule.id);
    this._rules$.next(this._rules$.value.filter((r) => r.id !== rule.id));
  }

  /** Delete many rules at once, dropping them all from local state. */
  async deleteMany(rules: AccessRuleResponse[]): Promise<void> {
    await Promise.all(
      rules.map((rule) => this.pamApi.deleteAccessRule(this.requireOrganizationId(), rule.id)),
    );
    const removed = new Set(rules.map((r) => r.id));
    this._rules$.next(this._rules$.value.filter((r) => !removed.has(r.id)));
  }

  private requireOrganizationId(): OrganizationId {
    if (this.organizationId == null) {
      throw new Error("AccessRulesService.load must run before mutating rules.");
    }
    return this.organizationId;
  }

  private buildRows(rules: AccessRuleResponse[], names: Map<string, string>): AccessRuleRow[] {
    const now = Date.now();
    return rules.map((rule) => {
      const revisionDate = Date.parse(rule.revisionDate);
      return {
        id: rule.id,
        rule,
        name: rule.name,
        enabled: rule.enabled,
        status: this.i18nService.t(rule.enabled ? "pamAccessRuleEnabled" : "disabled"),
        revisionDate: Number.isNaN(revisionDate) ? 0 : revisionDate,
        collectionNames: rule.collections
          .map((id) => names.get(id) ?? id)
          .sort((a, b) => a.localeCompare(b)),
        conditionBadges: conditionBadges(rule.conditions),
        accessWindow: accessRuleWindow(rule),
        lastModified: Number.isNaN(revisionDate)
          ? ""
          : formatRelativeTime(revisionDate, now, this.relativeTimeFormat),
      };
    });
  }
}

function conditionBadges(conditions: AccessCondition[]): ConditionBadge[] {
  const badges: ConditionBadge[] = [];
  const requiresApproval = conditions.some((c) => c.kind === "human_approval");
  badges.push(
    requiresApproval
      ? { icon: "bwi-users", labelKey: "pamAccessRuleConditionRequiresApproval" }
      : { icon: "bwi-check", labelKey: "pamAccessRuleConditionAutoApproved" },
  );
  if (conditions.some((c) => c.kind === "ip_allowlist")) {
    badges.push({ icon: "bwi-globe", labelKey: "pamAccessRuleConditionIpRestricted" });
  }
  return badges;
}
