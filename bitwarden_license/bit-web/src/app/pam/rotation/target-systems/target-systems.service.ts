import { Injectable, inject } from "@angular/core";
import { BehaviorSubject, Observable, combineLatest, map } from "rxjs";

import { OrganizationId } from "@bitwarden/common/types/guid";

import { TargetSystemId, TargetSystemMethod, TargetSystemStatus, TargetSystem } from "../rotation";
import { RotationSdkService } from "../rotation-sdk.service";

/**
 * Page-scoped data service for the target-systems tab.
 *
 * Provided at the rotation shell route so all rotation tabs share one loaded instance; owns the
 * list of target systems, exposes derived lookups, and handles the enable/disable toggle with
 * optimistic patching.
 *
 * Delete and disable aren't interchangeable: disable retires a merely unavailable target,
 * leaving it and its configs intact; delete is for one that has left the estate, and the server
 * — not this service — refuses it while any config still names the target.
 */
@Injectable()
export class TargetSystemsService {
  private readonly rotationSdk = inject(RotationSdkService);

  /** Set by {@link load}; the org all subsequent mutations target. */
  private organizationId: OrganizationId | null = null;

  /** Incremented per {@link load} call so a superseded call can drop its outcome. */
  private loadGeneration = 0;

  private readonly _systems$ = new BehaviorSubject<TargetSystem[]>([]);
  private readonly _loading$ = new BehaviorSubject<boolean>(true);
  private readonly _loadError$ = new BehaviorSubject<unknown | null>(null);

  readonly systems$: Observable<TargetSystem[]> = this._systems$.asObservable();
  readonly loading$: Observable<boolean> = this._loading$.asObservable();

  /** The error from the last {@link load}, or null when it succeeded. */
  readonly loadError$: Observable<unknown | null> = this._loadError$.asObservable();

  /** A map from targetSystemId → TargetSystem for O(1) lookups in derived services. */
  readonly systemById$: Observable<Map<TargetSystemId, TargetSystem>> = this._systems$.pipe(
    map((systems) => new Map(systems.map((s) => [s.id, s]))),
  );

  /** The subset of systems that are Active and use the Automatic method — the valid choices for a new rotation config. */
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
   * Records a failure on {@link loadError$} rather than rejecting, so the tabs that call this as
   * `void load(...)` can render an error state instead of an empty list. The callers that await it
   * — `RotationConfigsService.load`, the rotation config edit page and the connector detail page
   * — don't see a rejection either, and must read {@link loadError$} to tell a failed load
   * from an empty one.
   *
   * Several tabs load this shared instance, so two calls can be in flight at once. Each call holds
   * a generation token and records nothing once a later call has superseded it, so neither
   * ordering lets the losing call latch its outcome over the winning call's.
   */
  async load(organizationId: OrganizationId): Promise<void> {
    this.organizationId = organizationId;
    const generation = ++this.loadGeneration;
    this._loading$.next(true);
    this._loadError$.next(null);
    try {
      const systems = await this.rotationSdk.listTargetSystems(organizationId);
      if (generation !== this.loadGeneration) {
        return;
      }
      this._systems$.next(systems);
      this._loadError$.next(null);
    } catch (e) {
      if (generation !== this.loadGeneration) {
        return;
      }
      this._loadError$.next(e);
    } finally {
      if (generation === this.loadGeneration) {
        this._loading$.next(false);
      }
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
   * Not optimistic: the server refuses while a rotation config still names the target, and
   * that's the common case, so the row stays until it's genuinely gone.
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
