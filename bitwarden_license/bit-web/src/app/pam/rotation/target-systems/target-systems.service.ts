import { Injectable, inject } from "@angular/core";
import { BehaviorSubject, Observable, combineLatest, map } from "rxjs";

import {
  PamApiService,
  TargetSystemResponse,
  TargetSystemStatus,
  TargetSystemMethod,
} from "@bitwarden/bit-pam";
import { OrganizationId } from "@bitwarden/common/types/guid";

/**
 * Page-scoped data service for the target-systems tab.
 *
 * Provided at the rotation shell route so all rotation tabs share one loaded instance.
 * Owns the list of target systems, exposes derived lookups (`systemById$`,
 * `activeAutomaticSystems$`), and handles the enable/disable toggle with optimistic patching.
 */
@Injectable()
export class TargetSystemsService {
  private readonly pamApi = inject(PamApiService);

  /** Set by {@link load}; the org all subsequent mutations target. */
  private organizationId: OrganizationId | null = null;

  private readonly _systems$ = new BehaviorSubject<TargetSystemResponse[]>([]);
  private readonly _loading$ = new BehaviorSubject<boolean>(true);

  readonly systems$: Observable<TargetSystemResponse[]> = this._systems$.asObservable();
  readonly loading$: Observable<boolean> = this._loading$.asObservable();

  /** A map from targetSystemId → TargetSystemResponse for O(1) lookups in derived services. */
  readonly systemById$: Observable<Map<string, TargetSystemResponse>> = this._systems$.pipe(
    map((systems) => new Map(systems.map((s) => [s.id, s]))),
  );

  /**
   * The subset of systems that are Active and use the Automatic method — these are the valid
   * choices when selecting a target system for a new rotation config.
   */
  readonly activeAutomaticSystems$: Observable<TargetSystemResponse[]> = combineLatest([
    this._systems$,
  ]).pipe(
    map(([systems]) =>
      systems.filter(
        (s) => s.status === TargetSystemStatus.Active && s.method === TargetSystemMethod.Automatic,
      ),
    ),
  );

  /** Fetch the org's target systems, replacing local state. */
  async load(organizationId: OrganizationId): Promise<void> {
    this.organizationId = organizationId;
    this._loading$.next(true);
    try {
      const response = await this.pamApi.listTargetSystems(organizationId);
      this._systems$.next(response.data);
    } finally {
      this._loading$.next(false);
    }
  }

  /**
   * Enable or disable a target system, optimistically patching local state.
   * The server returns 204 for enable/disable; state is patched by toggling the status field.
   */
  async setEnabled(system: TargetSystemResponse, enabled: boolean): Promise<void> {
    const orgId = this.requireOrganizationId();
    if (enabled) {
      await this.pamApi.enableTargetSystem(orgId, system.id);
    } else {
      await this.pamApi.disableTargetSystem(orgId, system.id);
    }
    const nextStatus = enabled ? TargetSystemStatus.Active : TargetSystemStatus.Disabled;
    this._systems$.next(
      this._systems$.value.map((s) =>
        s.id === system.id ? ({ ...s, status: nextStatus } as TargetSystemResponse) : s,
      ),
    );
  }

  /**
   * Delete a target system, removing it from local state once the server confirms.
   * Waits for the server (which rejects if rotation configs still reference it) before
   * mutating local state, so a failed delete leaves the list unchanged.
   */
  async delete(system: TargetSystemResponse): Promise<void> {
    const orgId = this.requireOrganizationId();
    await this.pamApi.deleteTargetSystem(orgId, system.id);
    this._systems$.next(this._systems$.value.filter((s) => s.id !== system.id));
  }

  private requireOrganizationId(): OrganizationId {
    if (this.organizationId == null) {
      throw new Error("TargetSystemsService.load must run before mutating target systems.");
    }
    return this.organizationId;
  }
}
