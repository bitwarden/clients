import { Injectable, inject } from "@angular/core";
import { BehaviorSubject, Observable, firstValueFrom } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { OrganizationId } from "@bitwarden/common/types/guid";

import {
  AccessRuleSdkService,
  AccessRuleView,
  accessRuleToCopyRequest,
  accessRuleToRequest,
  rulesChangingEnabled,
} from "..";

import { GovernedCollectionsService } from "./governed-collections.service";

/** Data service for the access rules table, provided per `AccessRulesComponent`. */
@Injectable()
export class AccessRulesService {
  private readonly pamApi = inject(AccessRuleSdkService);
  private readonly accountService = inject(AccountService);
  private readonly collectionAdminService = inject(CollectionAdminService);
  private readonly governedCollections = inject(GovernedCollectionsService);

  /** Set by {@link load}; the org all subsequent mutations target. */
  private organizationId: OrganizationId | null = null;

  private readonly _rules$ = new BehaviorSubject<AccessRuleView[]>([]);
  private readonly _collections$ = new BehaviorSubject<CollectionAdminView[]>([]);
  private readonly _loading$ = new BehaviorSubject<boolean>(true);

  readonly rules$: Observable<AccessRuleView[]> = this._rules$.asObservable();
  readonly collections$: Observable<CollectionAdminView[]> = this._collections$.asObservable();
  readonly loading$: Observable<boolean> = this._loading$.asObservable();

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

  getRule(id: string): AccessRuleView | undefined {
    return this._rules$.value.find((r) => uuidAsString(r.id) === id);
  }

  /**
   * Persists immediately, so `name` must already be collision-free (see {@link copyRuleName}). The
   * copy governs no collections, so the governed-collections cache stays valid.
   */
  async copy(rule: AccessRuleView, name: string): Promise<AccessRuleView> {
    const created = await this.pamApi.createAccessRule(
      this.requireOrganizationId(),
      accessRuleToCopyRequest(rule, name),
    );
    this._rules$.next([...this._rules$.value, created]);
    return created;
  }

  /**
   * Invalidates the governed-collections cache, since `rulesGoverningCollection` filters its cached
   * rules on `enabled`.
   */
  async setEnabled(rule: AccessRuleView, enabled: boolean): Promise<void> {
    const organizationId = this.requireOrganizationId();
    const updated = await this.pamApi.updateAccessRule(
      organizationId,
      rule.id,
      accessRuleToRequest(rule, enabled),
    );
    this.governedCollections.invalidate(organizationId);
    this._rules$.next(this._rules$.value.map((r) => (r.id === rule.id ? updated : r)));
  }

  /** Returns how many rules changed; a no-op returns early without invalidating the cache. */
  async setManyEnabled(rules: AccessRuleView[], enabled: boolean): Promise<number> {
    const targets = rulesChangingEnabled(rules, enabled);
    if (targets.length === 0) {
      return 0;
    }
    const organizationId = this.requireOrganizationId();
    let updated;
    try {
      updated = await Promise.all(
        targets.map((rule) =>
          this.pamApi.updateAccessRule(organizationId, rule.id, accessRuleToRequest(rule, enabled)),
        ),
      );
    } finally {
      // A partial toggle still changed what `rulesGoverningCollection` reports.
      this.governedCollections.invalidate(organizationId);
    }
    const byId = new Map(
      updated.map((r: AccessRuleView): [string, AccessRuleView] => [uuidAsString(r.id), r]),
    );
    this._rules$.next(this._rules$.value.map((r) => byId.get(uuidAsString(r.id)) ?? r));
    return updated.length;
  }

  /** Invalidates the governed-collections cache so the freed collections reappear in the picker. */
  async delete(rule: AccessRuleView): Promise<void> {
    const organizationId = this.requireOrganizationId();
    await this.pamApi.deleteAccessRule(organizationId, rule.id);
    this.governedCollections.invalidate(organizationId);
    this._rules$.next(this._rules$.value.filter((r) => r.id !== rule.id));
  }

  /**
   * Invalidates whatever the outcome, since `Promise.all` rejects on the first failure while its
   * siblings still land server-side.
   */
  async deleteMany(rules: AccessRuleView[]): Promise<void> {
    const organizationId = this.requireOrganizationId();
    try {
      await Promise.all(rules.map((rule) => this.pamApi.deleteAccessRule(organizationId, rule.id)));
    } finally {
      this.governedCollections.invalidate(organizationId);
    }
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
