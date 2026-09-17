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
export type AccessConnectorRow = {
  id: AccessConnectorId;
  name: string;
  statusLabelKey: "pamAccessConnectorStatusActive" | "pamAccessConnectorStatusInactive";
  isConnected: boolean;
  /** Target system names for the assignment badges, falling back to the raw ID when unresolved. */
  assignmentNames: string[];
  /** True when the access connector is enabled; drives the Deactivate/Activate action and assignment availability. */
  enabled: boolean;
  /** True only when the access connector is enabled; required for it to be assigned a target. */
  canAssign: boolean;
  /** The raw response, kept for mutation operations. */
  accessConnector: AccessConnector;
};

/**
 * Page-scoped data service for the access connectors tab.
 *
 * Provided at the rotation-shell route together with `TargetSystemsService`.
 * Owns the access connector list, projects rows with name resolution, and handles all
 * access connector mutations (enable/disable, delete, assign, unassign) with optimistic local patching.
 */
@Injectable()
export class AccessConnectorsService {
  private readonly rotationSdk = inject(RotationSdkService);
  private readonly targetSystemsService = inject(TargetSystemsService);

  /** Set by {@link load}; the org all subsequent mutations target. */
  private organizationId: OrganizationId | null = null;

  /** Incremented per {@link load} call so a superseded call can drop its outcome. */
  private loadGeneration = 0;

  private readonly _accessConnectors$ = new BehaviorSubject<AccessConnector[]>([]);
  private readonly _loading$ = new BehaviorSubject<boolean>(true);
  private readonly _loadError$ = new BehaviorSubject<unknown | null>(null);

  readonly accessConnectors$: Observable<AccessConnector[]> =
    this._accessConnectors$.asObservable();
  readonly loading$: Observable<boolean> = this._loading$.asObservable();

  /** The error from the last {@link load}, or null when it succeeded. */
  readonly loadError$: Observable<unknown | null> = combineLatest([
    this._loadError$,
    this.targetSystemsService.loadError$,
  ]).pipe(map(([own, targetSystemsError]) => own ?? targetSystemsError));

  /** AccessConnectors projected into presentation rows, joined with target-system names; updates with either source. */
  readonly rows$: Observable<AccessConnectorRow[]> = combineLatest([
    this._accessConnectors$,
    this.targetSystemsService.systemById$,
  ]).pipe(map(([accessConnectors, systemById]) => this.buildRows(accessConnectors, systemById)));

  /**
   * Fetch the org's access connectors, replacing local state.
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
      this._accessConnectors$.next(connectors);
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
   * Enable or disable an access connector, optimistically patching local status.
   * Disabling stops it from claiming new jobs (running jobs are released); it is reversible via
   * enable. Rolls back and re-throws on API failure.
   */
  async setEnabled(accessConnector: AccessConnector, enabled: boolean): Promise<void> {
    const orgId = this.requireOrganizationId();
    const prevAccessConnectors = this._accessConnectors$.value;
    const nextStatus = enabled ? AccessConnectorStatus.Enabled : AccessConnectorStatus.Disabled;

    // Optimistic update
    this._accessConnectors$.next(
      prevAccessConnectors.map((d) =>
        d.id === accessConnector.id ? ({ ...d, status: nextStatus } as AccessConnector) : d,
      ),
    );

    try {
      if (enabled) {
        await this.rotationSdk.enableConnector(orgId, accessConnector.id);
      } else {
        await this.rotationSdk.disableConnector(orgId, accessConnector.id);
      }
    } catch (e) {
      // Rollback
      this._accessConnectors$.next(prevAccessConnectors);
      throw e;
    }
  }

  /**
   * Delete an access connector permanently, removing it from local state once the server confirms.
   *
   * This invalidates the access connector's credentials; since it held the org key in memory, rotate the
   * organization key if compromise is suspected.
   */
  async delete(accessConnector: AccessConnector): Promise<void> {
    const orgId = this.requireOrganizationId();
    await this.rotationSdk.deleteConnector(orgId, accessConnector.id);
    this._accessConnectors$.next(
      this._accessConnectors$.value.filter((d) => d.id !== accessConnector.id),
    );
  }

  /**
   * Drop a deleted target system from every access connector's assignments.
   *
   * Deleting a target takes its assignments with it server-side; without this, {@link rows$}
   * would keep projecting the dangling ID as a raw UUID. Purely local reconciliation of that
   * server-side delete.
   */
  forgetTargetSystem(targetSystemId: TargetSystemId): void {
    this._accessConnectors$.next(
      this._accessConnectors$.value.map((d) =>
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
   * Assign a target system to an access connector. Optimistically pushes the target ID into
   * the access connector's assignments; rolls back and re-throws on failure.
   */
  async assign(accessConnector: AccessConnector, targetSystemId: TargetSystemId): Promise<void> {
    const orgId = this.requireOrganizationId();
    const prevAccessConnectors = this._accessConnectors$.value;

    // Optimistic update
    this._accessConnectors$.next(
      prevAccessConnectors.map((d) =>
        d.id === accessConnector.id
          ? ({
              ...d,
              assignedTargetSystemIds: [...d.assignedTargetSystemIds, targetSystemId],
            } as AccessConnector)
          : d,
      ),
    );

    try {
      await this.rotationSdk.assignTarget(orgId, accessConnector.id, targetSystemId);
    } catch (e) {
      // Rollback
      this._accessConnectors$.next(prevAccessConnectors);
      throw e;
    }
  }

  /**
   * Remove a target-system assignment from an access connector. Optimistically removes the
   * ID from the local state; rolls back and re-throws on failure.
   */
  async unassign(accessConnector: AccessConnector, targetSystemId: TargetSystemId): Promise<void> {
    const orgId = this.requireOrganizationId();
    const prevAccessConnectors = this._accessConnectors$.value;

    // Optimistic update
    this._accessConnectors$.next(
      prevAccessConnectors.map((d) =>
        d.id === accessConnector.id
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
      await this.rotationSdk.unassignTarget(orgId, accessConnector.id, targetSystemId);
    } catch (e) {
      // Rollback
      this._accessConnectors$.next(prevAccessConnectors);
      throw e;
    }
  }

  /**
   * Call after a successful access connector registration to refresh the list from the server.
   */
  async registerCompleted(organizationId: OrganizationId): Promise<void> {
    await this.load(organizationId);
  }

  private requireOrganizationId(): OrganizationId {
    if (this.organizationId == null) {
      throw new Error("AccessConnectorsService.load must run before mutating accessConnectors.");
    }
    return this.organizationId;
  }

  private buildRows(
    accessConnectors: AccessConnector[],
    systemById: Map<TargetSystemId, TargetSystem>,
  ): AccessConnectorRow[] {
    return accessConnectors.map((accessConnector) => ({
      id: accessConnector.id,
      name: accessConnector.name,
      statusLabelKey: accessConnectorStatusLabelKey(accessConnector.status),
      isConnected: accessConnector.isConnected,
      assignmentNames: accessConnector.assignedTargetSystemIds.map(
        (id) => systemById.get(id)?.name ?? String(id),
      ),
      enabled: accessConnector.status === AccessConnectorStatus.Enabled,
      canAssign: accessConnector.status === AccessConnectorStatus.Enabled,
      accessConnector,
    }));
  }
}
