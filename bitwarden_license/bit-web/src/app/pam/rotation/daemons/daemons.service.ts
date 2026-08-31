import { Injectable, inject } from "@angular/core";
import { BehaviorSubject, Observable, combineLatest, map } from "rxjs";

import { OrganizationId } from "@bitwarden/common/types/guid";

import {
  AccessConnectorId,
  AccessConnectorView,
  DaemonStatus,
  TargetSystemId,
  TargetSystemView,
} from "../rotation";
import { RotationSdkService } from "../rotation-sdk.service";
import { TargetSystemsService } from "../target-systems/target-systems.service";

/**
 * Presentation-ready view of a single {@link AccessConnectorView}.
 *
 * Flattens assignment IDs into display names using the target-systems lookup,
 * and pre-computes action availability flags so the template stays declarative.
 */
export type DaemonRow = {
  id: AccessConnectorId;
  name: string;
  /** i18n key for the status badge label: pamDaemonStatusEnabled | pamDaemonStatusDisabled. */
  statusLabelKey: string;
  isConnected: boolean;
  /** Target system names for the assignment badges; falls back to the raw ID when not found. */
  assignmentNames: string[];
  /** True when the daemon is enabled — drives Disable vs Enable and assign availability. */
  enabled: boolean;
  /** True when the daemon is enabled — only then can it be assigned a target. */
  canAssign: boolean;
  /** The raw response, kept for mutation operations. */
  daemon: AccessConnectorView;
};

/**
 * Page-scoped data service for the daemons tab.
 *
 * Provided at the rotation-shell route together with `TargetSystemsService`.
 * Owns the daemon list, projects rows with name resolution, and handles all
 * daemon mutations (enable/disable, delete, assign, unassign) with optimistic local patching.
 */
@Injectable()
export class DaemonsService {
  private readonly rotationSdk = inject(RotationSdkService);
  private readonly targetSystemsService = inject(TargetSystemsService);

  /** Set by {@link load}; the org all subsequent mutations target. */
  private organizationId: OrganizationId | null = null;

  private readonly _daemons$ = new BehaviorSubject<AccessConnectorView[]>([]);
  private readonly _loading$ = new BehaviorSubject<boolean>(true);

  readonly daemons$: Observable<AccessConnectorView[]> = this._daemons$.asObservable();
  readonly loading$: Observable<boolean> = this._loading$.asObservable();

  /**
   * Daemons projected into presentation rows, joined with target-system names.
   * Updates automatically whenever the daemon list or target-systems map changes.
   */
  readonly rows$: Observable<DaemonRow[]> = combineLatest([
    this._daemons$,
    this.targetSystemsService.systemById$,
  ]).pipe(map(([daemons, systemById]) => this.buildRows(daemons, systemById)));

  /** Fetch the org's daemons, replacing local state. */
  async load(organizationId: OrganizationId): Promise<void> {
    this.organizationId = organizationId;
    this._loading$.next(true);
    try {
      this._daemons$.next(await this.rotationSdk.listConnectors(organizationId));
    } finally {
      this._loading$.next(false);
    }
  }

  /**
   * Enable or disable a daemon, optimistically patching local status.
   * Disabling stops it from claiming new jobs (running jobs are released); it is reversible via
   * enable. Rolls back and re-throws on API failure.
   */
  async setEnabled(daemon: AccessConnectorView, enabled: boolean): Promise<void> {
    const orgId = this.requireOrganizationId();
    const prevDaemons = this._daemons$.value;
    const nextStatus = enabled ? DaemonStatus.Enabled : DaemonStatus.Disabled;

    // Optimistic update
    this._daemons$.next(
      prevDaemons.map((d) =>
        d.id === daemon.id ? ({ ...d, status: nextStatus } as AccessConnectorView) : d,
      ),
    );

    try {
      if (enabled) {
        await this.rotationSdk.enableConnector(orgId, daemon.id);
      } else {
        await this.rotationSdk.disableConnector(orgId, daemon.id);
      }
    } catch (e) {
      // Rollback
      this._daemons$.next(prevDaemons);
      throw e;
    }
  }

  /**
   * Delete a daemon permanently, removing it from local state once the server confirms.
   * This invalidates the daemon's credentials; the daemon held the org key in memory, so if
   * compromise is suspected, rotate the organization key as a remediation.
   */
  async delete(daemon: AccessConnectorView): Promise<void> {
    const orgId = this.requireOrganizationId();
    await this.rotationSdk.deleteConnector(orgId, daemon.id);
    this._daemons$.next(this._daemons$.value.filter((d) => d.id !== daemon.id));
  }

  /**
   * Assign a target system to a daemon. Optimistically pushes the target ID into
   * the daemon's assignments; rolls back and re-throws on failure.
   */
  async assign(daemon: AccessConnectorView, targetSystemId: TargetSystemId): Promise<void> {
    const orgId = this.requireOrganizationId();
    const prevDaemons = this._daemons$.value;

    // Optimistic update
    this._daemons$.next(
      prevDaemons.map((d) =>
        d.id === daemon.id
          ? ({
              ...d,
              assignedTargetSystemIds: [...d.assignedTargetSystemIds, targetSystemId],
            } as AccessConnectorView)
          : d,
      ),
    );

    try {
      await this.rotationSdk.assignTarget(orgId, daemon.id, targetSystemId);
    } catch (e) {
      // Rollback
      this._daemons$.next(prevDaemons);
      throw e;
    }
  }

  /**
   * Remove a target-system assignment from a daemon. Optimistically removes the
   * ID from the local state; rolls back and re-throws on failure.
   */
  async unassign(daemon: AccessConnectorView, targetSystemId: TargetSystemId): Promise<void> {
    const orgId = this.requireOrganizationId();
    const prevDaemons = this._daemons$.value;

    // Optimistic update
    this._daemons$.next(
      prevDaemons.map((d) =>
        d.id === daemon.id
          ? ({
              ...d,
              assignedTargetSystemIds: d.assignedTargetSystemIds.filter((id) => id !== targetSystemId),
            } as AccessConnectorView)
          : d,
      ),
    );

    try {
      await this.rotationSdk.unassignTarget(orgId, daemon.id, targetSystemId);
    } catch (e) {
      // Rollback
      this._daemons$.next(prevDaemons);
      throw e;
    }
  }

  /**
   * Call after a successful daemon registration to refresh the list from the server.
   */
  async registerCompleted(organizationId: OrganizationId): Promise<void> {
    await this.load(organizationId);
  }

  private requireOrganizationId(): OrganizationId {
    if (this.organizationId == null) {
      throw new Error("DaemonsService.load must run before mutating daemons.");
    }
    return this.organizationId;
  }

  private buildRows(
    daemons: AccessConnectorView[],
    systemById: Map<TargetSystemId, TargetSystemView>,
  ): DaemonRow[] {
    return daemons.map((daemon) => ({
      id: daemon.id,
      name: daemon.name,
      statusLabelKey:
        daemon.status === DaemonStatus.Enabled
          ? "pamDaemonStatusEnabled"
          : "pamDaemonStatusDisabled",
      isConnected: daemon.isConnected,
      assignmentNames: daemon.assignedTargetSystemIds.map(
        (id) => systemById.get(id)?.name ?? String(id),
      ),
      enabled: daemon.status === DaemonStatus.Enabled,
      canAssign: daemon.status === DaemonStatus.Enabled,
      daemon,
    }));
  }
}
