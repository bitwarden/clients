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

export type AccessConnectorRow = {
  id: AccessConnectorId;
  name: string;
  statusLabelKey: "pamAccessConnectorStatusActive" | "pamAccessConnectorStatusInactive";
  isConnected: boolean;
  /** Target system names for the assignment badges, falling back to the raw ID when unresolved. */
  assignmentNames: string[];
  enabled: boolean;
  /** Only an enabled access connector can be assigned a target. */
  canAssign: boolean;
  /** The raw response, kept for mutation operations. */
  accessConnector: AccessConnector;
};

/**
 * Data service for the access connectors tab, provided at the rotation shell route so the tabs
 * share one load. Mutations other than delete patch local state first and roll back on failure.
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

  /** This list's load error, else the target-system read's; null when both succeeded. */
  readonly loadError$: Observable<unknown | null> = combineLatest([
    this._loadError$,
    this.targetSystemsService.loadError$,
  ]).pipe(map(([own, targetSystemsError]) => own ?? targetSystemsError));

  readonly rows$: Observable<AccessConnectorRow[]> = combineLatest([
    this._accessConnectors$,
    this.targetSystemsService.systemById$,
  ]).pipe(map(([accessConnectors, systemById]) => this.buildRows(accessConnectors, systemById)));

  /**
   * Records a failure on {@link loadError$} rather than rejecting, since callers `void` it and
   * would otherwise show an empty state. Two tabs share this instance, so a superseded call
   * records nothing.
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

  async setEnabled(accessConnector: AccessConnector, enabled: boolean): Promise<void> {
    const orgId = this.requireOrganizationId();
    const prevAccessConnectors = this._accessConnectors$.value;
    const nextStatus = enabled ? AccessConnectorStatus.Enabled : AccessConnectorStatus.Disabled;

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
      this._accessConnectors$.next(prevAccessConnectors);
      throw e;
    }
  }

  async delete(accessConnector: AccessConnector): Promise<void> {
    const orgId = this.requireOrganizationId();
    await this.rotationSdk.deleteConnector(orgId, accessConnector.id);
    this._accessConnectors$.next(
      this._accessConnectors$.value.filter((d) => d.id !== accessConnector.id),
    );
  }

  /**
   * Mirrors the server, which drops a deleted target's assignments; otherwise {@link rows$} would
   * show the dangling id as a raw UUID.
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

  async assign(accessConnector: AccessConnector, targetSystemId: TargetSystemId): Promise<void> {
    const orgId = this.requireOrganizationId();
    const prevAccessConnectors = this._accessConnectors$.value;

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
      this._accessConnectors$.next(prevAccessConnectors);
      throw e;
    }
  }

  async unassign(accessConnector: AccessConnector, targetSystemId: TargetSystemId): Promise<void> {
    const orgId = this.requireOrganizationId();
    const prevAccessConnectors = this._accessConnectors$.value;

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
      this._accessConnectors$.next(prevAccessConnectors);
      throw e;
    }
  }

  async registerCompleted(organizationId: OrganizationId): Promise<void> {
    await this.load(organizationId);
  }

  private requireOrganizationId(): OrganizationId {
    if (this.organizationId == null) {
      throw new Error("AccessConnectorsService.load must run before mutating access connectors.");
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
