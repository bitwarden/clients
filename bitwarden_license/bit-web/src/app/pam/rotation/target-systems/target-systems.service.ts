import { Injectable, inject } from "@angular/core";
import { BehaviorSubject, Observable, combineLatest, map } from "rxjs";

import { OrganizationId } from "@bitwarden/common/types/guid";

import {
  TargetSystemId,
  TargetSystemMethod,
  TargetSystemStatus,
  TargetSystemView,
} from "../rotation";
import { RotationSdkService } from "../rotation-sdk.service";

/**
 * Page-scoped data service for the target-systems tab.
 *
 * Provided at the rotation shell route so all rotation tabs share one loaded instance.
 * Owns the list of target systems, exposes derived lookups (`systemById$`,
 * `activeAutomaticSystems$`), and handles the enable/disable toggle with optimistic patching.
 *
 * There is deliberately no delete: the server exposes no route for it, because rotation configs
 * reference targets and a rotation's history has to stay attributable. Retiring one is `disable`.
 */
@Injectable()
export class TargetSystemsService {
  private readonly rotationSdk = inject(RotationSdkService);

  /** Set by {@link load}; the org all subsequent mutations target. */
  private organizationId: OrganizationId | null = null;

  private readonly _systems$ = new BehaviorSubject<TargetSystemView[]>([]);
  private readonly _loading$ = new BehaviorSubject<boolean>(true);

  readonly systems$: Observable<TargetSystemView[]> = this._systems$.asObservable();
  readonly loading$: Observable<boolean> = this._loading$.asObservable();

  /** A map from targetSystemId → TargetSystemView for O(1) lookups in derived services. */
  readonly systemById$: Observable<Map<TargetSystemId, TargetSystemView>> = this._systems$.pipe(
    map((systems) => new Map(systems.map((s) => [s.id, s]))),
  );

  /**
   * The subset of systems that are Active and use the Automatic method — these are the valid
   * choices when selecting a target system for a new rotation config.
   */
  readonly activeAutomaticSystems$: Observable<TargetSystemView[]> = combineLatest([
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
      this._systems$.next(await this.rotationSdk.listTargetSystems(organizationId));
    } finally {
      this._loading$.next(false);
    }
  }

  /**
   * Enable or disable a target system, optimistically patching local state.
   * The server returns 204 for enable/disable; state is patched by toggling the status field.
   */
  async setEnabled(system: TargetSystemView, enabled: boolean): Promise<void> {
    const orgId = this.requireOrganizationId();
    if (enabled) {
      await this.rotationSdk.enableTargetSystem(orgId, system.id);
    } else {
      await this.rotationSdk.disableTargetSystem(orgId, system.id);
    }
    const nextStatus = enabled ? TargetSystemStatus.Active : TargetSystemStatus.Disabled;
    this._systems$.next(
      this._systems$.value.map((s) =>
        s.id === system.id ? ({ ...s, status: nextStatus } as TargetSystemView) : s,
      ),
    );
  }

  private requireOrganizationId(): OrganizationId {
    if (this.organizationId == null) {
      throw new Error("TargetSystemsService.load must run before mutating target systems.");
    }
    return this.organizationId;
  }
}
