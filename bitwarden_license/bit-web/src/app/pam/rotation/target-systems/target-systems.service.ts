import { Injectable, inject } from "@angular/core";
import { BehaviorSubject, Observable, combineLatest, map } from "rxjs";

import { OrganizationId } from "@bitwarden/common/types/guid";

import { TargetSystemId, TargetSystemMethod, TargetSystemStatus, TargetSystem } from "../rotation";
import { RotationSdkService } from "../rotation-sdk.service";

/**
 * Page-scoped data service for the target-systems tab.
 *
 * Provided at the rotation shell route so all rotation tabs share one loaded instance.
 * Owns the list of target systems, exposes derived lookups (`systemById$`,
 * `activeAutomaticSystems$`), and handles the enable/disable toggle with optimistic patching.
 *
 * Delete and disable are not interchangeable: `disable` retires a target that is merely
 * unavailable, leaving it and its configs intact, while `delete` is for one that has left the
 * estate. The server refuses a delete while any rotation config still names the target, so it —
 * not this service — is the authority on whether one is allowed.
 */
@Injectable()
export class TargetSystemsService {
  private readonly rotationSdk = inject(RotationSdkService);

  /** Set by {@link load}; the org all subsequent mutations target. */
  private organizationId: OrganizationId | null = null;

  private readonly _systems$ = new BehaviorSubject<TargetSystem[]>([]);
  private readonly _loading$ = new BehaviorSubject<boolean>(true);
  private readonly _loadError$ = new BehaviorSubject<unknown | null>(null);

  readonly systems$: Observable<TargetSystem[]> = this._systems$.asObservable();
  readonly loading$: Observable<boolean> = this._loading$.asObservable();

  /** The error from the last {@link load}, or null when it succeeded. */
  readonly loadError$: Observable<unknown | null> = this._loadError$.asObservable();

  /**
   * Synchronous read of the last load's outcome, for services that load this one as a dependency
   * and must reflect its failure in their own error state.
   */
  get lastLoadError(): unknown | null {
    return this._loadError$.value;
  }

  /** A map from targetSystemId → TargetSystem for O(1) lookups in derived services. */
  readonly systemById$: Observable<Map<TargetSystemId, TargetSystem>> = this._systems$.pipe(
    map((systems) => new Map(systems.map((s) => [s.id, s]))),
  );

  /**
   * The subset of systems that are Active and use the Automatic method — these are the valid
   * choices when selecting a target system for a new rotation config.
   */
  readonly activeAutomaticSystems$: Observable<TargetSystem[]> = combineLatest([
    this._systems$,
  ]).pipe(
    map(([systems]) =>
      systems.filter(
        (s) => s.status === TargetSystemStatus.Active && s.method === TargetSystemMethod.Automatic,
      ),
    ),
  );

  /**
   * Fetch the org's target systems, replacing local state.
   *
   * Records a failure on {@link loadError$} rather than rejecting: every caller invokes this as
   * `void load(...)`, so a rejection would leave the tab rendering its empty state.
   */
  async load(organizationId: OrganizationId): Promise<void> {
    this.organizationId = organizationId;
    this._loading$.next(true);
    this._loadError$.next(null);
    try {
      this._systems$.next(await this.rotationSdk.listTargetSystems(organizationId));
    } catch (e) {
      this._loadError$.next(e);
    } finally {
      this._loading$.next(false);
    }
  }

  /**
   * Enable or disable a target system, optimistically patching local state.
   * The server returns 204 for enable/disable; state is patched by toggling the status field.
   */
  async setEnabled(system: TargetSystem, enabled: boolean): Promise<void> {
    const orgId = this.requireOrganizationId();
    if (enabled) {
      await this.rotationSdk.enableTargetSystem(orgId, system.id);
    } else {
      await this.rotationSdk.disableTargetSystem(orgId, system.id);
    }
    const nextStatus = enabled ? TargetSystemStatus.Active : TargetSystemStatus.Disabled;
    this._systems$.next(
      this._systems$.value.map((s) =>
        s.id === system.id ? ({ ...s, status: nextStatus } as TargetSystem) : s,
      ),
    );
  }

  /**
   * Permanently delete a target system, dropping it from local state once the server confirms.
   *
   * Not optimistic: the server refuses while a rotation config still names the target, and that
   * refusal is the common case rather than the exceptional one, so the row stays until it is
   * genuinely gone. Callers surface the rejection to the operator.
   */
  async delete(system: TargetSystem): Promise<void> {
    const orgId = this.requireOrganizationId();
    await this.rotationSdk.deleteTargetSystem(orgId, system.id);
    this._systems$.next(this._systems$.value.filter((s) => s.id !== system.id));
  }

  private requireOrganizationId(): OrganizationId {
    if (this.organizationId == null) {
      throw new Error("TargetSystemsService.load must run before mutating target systems.");
    }
    return this.organizationId;
  }
}
