import { Injectable, inject } from "@angular/core";
import { BehaviorSubject, Observable, combineLatest, map } from "rxjs";

import { OrganizationId } from "@bitwarden/common/types/guid";

import {
  AccessConnectorId,
  AccessConnector,
  AccessConnectorStatus,
  TargetSystemId,
  TargetSystem,
} from "../rotation";
import { RotationSdkService } from "../rotation-sdk.service";
import { TargetSystemsService } from "../target-systems/target-systems.service";

import { accessConnectorStatusLabelKey } from "./access-connector-label";

/**
 * Presentation-ready view of a single {@link AccessConnector}.
 *
 * Flattens assignment IDs into display names using the target-systems lookup,
 * and pre-computes action availability flags so the template stays declarative.
 */
export type DaemonRow = {
  id: AccessConnectorId;
  name: string;
  statusLabelKey: "pamAccessConnectorStatusActive" | "pamAccessConnectorStatusInactive";
  isConnected: boolean;
  /** Target system names for the assignment badges, falling back to the raw ID when unresolved. */
  assignmentNames: string[];
  /** True when the daemon is enabled; drives the Deactivate/Activate action and assignment availability. */
  enabled: boolean;
  /** True only when the daemon is enabled; required for it to be assigned a target. */
  canAssign: boolean;
  /** The raw response, kept for mutation operations. */
  daemon: AccessConnector;
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

  /** Incremented per {@link load} call so a superseded call can drop its outcome. */
  private loadGeneration = 0;

  private readonly _daemons$ = new BehaviorSubject<AccessConnector[]>([]);
  private readonly _loading$ = new BehaviorSubject<boolean>(true);
  private readonly _loadError$ = new BehaviorSubject<unknown | null>(null);

  readonly daemons$: Observable<AccessConnector[]> = this._daemons$.asObservable();
  readonly loading$: Observable<boolean> = this._loading$.asObservable();

  /** The error from the last {@link load}, or null when it succeeded. */
  readonly loadError$: Observable<unknown | null> = combineLatest([
    this._loadError$,
    this.targetSystemsService.loadError$,
  ]).pipe(map(([own, targetSystemsError]) => own ?? targetSystemsError));

  /** Daemons projected into presentation rows, joined with target-system names; updates with either source. */
  readonly rows$: Observable<DaemonRow[]> = combineLatest([
    this._daemons$,
    this.targetSystemsService.systemById$,
  ]).pipe(map(([daemons, systemById]) => this.buildRows(daemons, systemById)));

  /**
   * Fetch the org's daemons, replacing local state.
   *
   * Records a failure on {@link loadError$} rather than rejecting: every caller invokes this as
   * `void load(...)`, so a rejection would leave the tab rendering its empty state.
   *
   * Two tabs load this shared instance, so two calls can be in flight at once. Each call holds a
   * generation token and records nothing once a later call has superseded it, so neither ordering
   * lets the losing call latch its outcome over the winning call's.
   */
  async load(organizationId: OrganizationId): Promise<void> {
    this.organizationId = organizationId;
    const generation = ++this.loadGeneration;
    this._loading$.next(true);
    this._loadError$.next(null);
    try {
      const connectors = await this.rotationSdk.listConnectors(organizationId);
      if (generation !== this.loadGeneration) {
        return;
      }
      this._daemons$.next(connectors);
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
   * Enable or disable a daemon, optimistically patching local status.
   * Disabling stops it from claiming new jobs (running jobs are released); it is reversible via
   * enable. Rolls back and re-throws on API failure.
   */
  async setEnabled(daemon: AccessConnector, enabled: boolean): Promise<void> {
    const orgId = this.requireOrganizationId();
    const prevDaemons = this._daemons$.value;
    const nextStatus = enabled ? AccessConnectorStatus.Enabled : AccessConnectorStatus.Disabled;

    // Optimistic update
    this._daemons$.next(
      prevDaemons.map((d) =>
        d.id === daemon.id ? ({ ...d, status: nextStatus } as AccessConnector) : d,
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
   *
   * This invalidates the daemon's credentials; since it held the org key in memory, rotate the
   * organization key if compromise is suspected.
   */
  async delete(daemon: AccessConnector): Promise<void> {
    const orgId = this.requireOrganizationId();
    await this.rotationSdk.deleteConnector(orgId, daemon.id);
    this._daemons$.next(this._daemons$.value.filter((d) => d.id !== daemon.id));
  }

  /**
   * Drop a deleted target system from every daemon's assignments.
   *
   * Deleting a target takes its assignments with it server-side; without this, {@link rows$}
   * would keep projecting the dangling ID as a raw UUID. Purely local reconciliation of that
   * server-side delete.
   */
  forgetTargetSystem(targetSystemId: TargetSystemId): void {
    this._daemons$.next(
      this._daemons$.value.map((d) =>
        d.assignedTargetSystemIds.includes(targetSystemId)
          ? ({
              ...d,
              assignedTargetSystemIds: d.assignedTargetSystemIds.filter(
                (id) => id !== targetSystemId,
              ),
            } as AccessConnector)
          : d,
      ),
    );
  }

  /**
   * Assign a target system to a daemon. Optimistically pushes the target ID into
   * the daemon's assignments; rolls back and re-throws on failure.
   */
  async assign(daemon: AccessConnector, targetSystemId: TargetSystemId): Promise<void> {
    const orgId = this.requireOrganizationId();
    const prevDaemons = this._daemons$.value;

    // Optimistic update
    this._daemons$.next(
      prevDaemons.map((d) =>
        d.id === daemon.id
          ? ({
              ...d,
              assignedTargetSystemIds: [...d.assignedTargetSystemIds, targetSystemId],
            } as AccessConnector)
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
  async unassign(daemon: AccessConnector, targetSystemId: TargetSystemId): Promise<void> {
    const orgId = this.requireOrganizationId();
    const prevDaemons = this._daemons$.value;

    // Optimistic update
    this._daemons$.next(
      prevDaemons.map((d) =>
        d.id === daemon.id
          ? ({
              ...d,
              assignedTargetSystemIds: d.assignedTargetSystemIds.filter(
                (id) => id !== targetSystemId,
              ),
            } as AccessConnector)
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
    daemons: AccessConnector[],
    systemById: Map<TargetSystemId, TargetSystem>,
  ): DaemonRow[] {
    return daemons.map((daemon) => ({
      id: daemon.id,
      name: daemon.name,
      statusLabelKey: accessConnectorStatusLabelKey(daemon.status),
      isConnected: daemon.isConnected,
      assignmentNames: daemon.assignedTargetSystemIds.map(
        (id) => systemById.get(id)?.name ?? String(id),
      ),
      enabled: daemon.status === AccessConnectorStatus.Enabled,
      canAssign: daemon.status === AccessConnectorStatus.Enabled,
      daemon,
    }));
  }
}
