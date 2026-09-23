import { Injectable, inject } from "@angular/core";
import { BehaviorSubject, Observable, firstValueFrom } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { OrganizationId } from "@bitwarden/common/types/guid";

import { AccessRuleSdkService, AccessRuleView, accessRuleToRequest } from "..";

/**
 * Page-level data service for the access rules table: owns the org's rule list and
 * collections, loads them, and performs the CRUD mutations (enable/disable, delete,
 * and their bulk variants). Rules are exposed as raw {@link AccessRuleView}s — the
 * view derives sorting, badges, and collection names from them directly.
 *
 * Provided at the component level so each `AccessRulesComponent` gets its own
 * instance. View concerns (toasts, confirm dialogs, selection, routing) stay in
 * the component; this service just owns state and the API round-trips.
 */
@Injectable()
export class AccessRulesService {
  private readonly pamApi = inject(AccessRuleSdkService);
  private readonly accountService = inject(AccountService);
  private readonly collectionAdminService = inject(CollectionAdminService);

  /** Set by {@link load}; the org all subsequent mutations target. */
  private organizationId: OrganizationId | null = null;

  private readonly _rules$ = new BehaviorSubject<AccessRuleView[]>([]);
  private readonly _collections$ = new BehaviorSubject<CollectionAdminView[]>([]);
  private readonly _loading$ = new BehaviorSubject<boolean>(true);

  readonly rules$: Observable<AccessRuleView[]> = this._rules$.asObservable();
  /** The org's collections; the view resolves rule collection ids to names against these. */
  readonly collections$: Observable<CollectionAdminView[]> = this._collections$.asObservable();
  readonly loading$: Observable<boolean> = this._loading$.asObservable();

  /** Fetch the org's rules and collections, replacing local state. */
  async load(organizationId: OrganizationId): Promise<void> {
    this.organizationId = organizationId;
    this._loading$.next(true);
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const [rules, collections] = await Promise.all([
        this.pamApi.listAccessRules(organizationId),
        firstValueFrom(this.collectionAdminService.collectionAdminViews$(organizationId, userId)),
      ]);
      this._collections$.next(collections);
      this._rules$.next(rules);
    } finally {
      this._loading$.next(false);
    }
  }

  /** The currently-loaded rule with the given id, if any. */
  getRule(id: string): AccessRuleView | undefined {
    return this._rules$.value.find((r) => uuidAsString(r.id) === id);
  }

  /** Toggle a single rule's enabled flag, patching local state with the result. */
  async setEnabled(rule: AccessRuleView, enabled: boolean): Promise<void> {
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
  async setManyEnabled(rules: AccessRuleView[], enabled: boolean): Promise<number> {
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
    const byId = new Map(
      updated.map((r: AccessRuleView): [string, AccessRuleView] => [uuidAsString(r.id), r]),
    );
    this._rules$.next(this._rules$.value.map((r) => byId.get(uuidAsString(r.id)) ?? r));
    return updated.length;
  }

  /** Delete a single rule, dropping it from local state. */
  async delete(rule: AccessRuleView): Promise<void> {
    await this.pamApi.deleteAccessRule(this.requireOrganizationId(), rule.id);
    this._rules$.next(this._rules$.value.filter((r) => r.id !== rule.id));
  }

  /** Delete many rules at once, dropping them all from local state. */
  async deleteMany(rules: AccessRuleView[]): Promise<void> {
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
}
