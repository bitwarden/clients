import { Injectable, inject } from "@angular/core";
import { BehaviorSubject, Observable, combineLatest, map } from "rxjs";

import { DaemonStatus, PamApiService, RotationDaemonResponse } from "@bitwarden/bit-pam";
import { OrganizationId } from "@bitwarden/common/types/guid";

import { TargetSystemsService } from "../target-systems/target-systems.service";

/**
 * Presentation-ready view of a single {@link RotationDaemonResponse}.
 *
 * Flattens assignment IDs into display names using the target-systems lookup,
 * and pre-computes action availability flags so the template stays declarative.
 */
export type DaemonRow = {
  id: string;
  name: string;
  /** i18n key for the status badge label: pamDaemonStatusEnrolled | pamDaemonStatusRevoked. */
  statusLabelKey: string;
  isConnected: boolean;
  /** Target system names for the assignment badges; falls back to the raw ID when not found. */
  assignmentNames: string[];
  /** True when the daemon is Enrolled — only then can it be assigned or revoked. */
  canRevoke: boolean;
  /** True when the daemon is Enrolled — only then can it be assigned. */
  canAssign: boolean;
  /** The raw response, kept for mutation operations. */
  daemon: RotationDaemonResponse;
};

/**
 * Page-scoped data service for the daemons tab.
 *
 * Provided at the rotation-shell route together with `TargetSystemsService`.
 * Owns the daemon list, projects rows with name resolution, and handles all
 * daemon mutations (revoke, assign, unassign) with optimistic local patching.
 */
@Injectable()
export class DaemonsService {
  private readonly pamApi = inject(PamApiService);
  private readonly targetSystemsService = inject(TargetSystemsService);

  /** Set by {@link load}; the org all subsequent mutations target. */
  private organizationId: OrganizationId | null = null;

  private readonly _daemons$ = new BehaviorSubject<RotationDaemonResponse[]>([]);
  private readonly _loading$ = new BehaviorSubject<boolean>(true);

  readonly daemons$: Observable<RotationDaemonResponse[]> = this._daemons$.asObservable();
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
      const response = await this.pamApi.listRotationDaemons(organizationId);
      this._daemons$.next(response.data);
    } finally {
      this._loading$.next(false);
    }
  }

  /**
   * Revoke a daemon permanently — patches local status to `Revoked`.
   *
   * Revocation is permanent. The daemon held the org key in memory.
   * If compromise is suspected, rotate the organization key as a remediation.
   * Running rotation jobs will be released automatically.
   */
  async revoke(daemon: RotationDaemonResponse): Promise<void> {
    const orgId = this.requireOrganizationId();
    await this.pamApi.revokeRotationDaemon(orgId, daemon.id);
    this._daemons$.next(
      this._daemons$.value.map((d) =>
        d.id === daemon.id ? ({ ...d, status: DaemonStatus.Revoked } as RotationDaemonResponse) : d,
      ),
    );
  }

  /**
   * Assign a target system to a daemon. Optimistically pushes the target ID into
   * the daemon's assignments; rolls back and re-throws on failure.
   */
  async assign(daemon: RotationDaemonResponse, targetSystemId: string): Promise<void> {
    const orgId = this.requireOrganizationId();
    const prevDaemons = this._daemons$.value;

    // Optimistic update
    this._daemons$.next(
      prevDaemons.map((d) =>
        d.id === daemon.id
          ? ({
              ...d,
              assignments: [...d.assignments, targetSystemId],
            } as RotationDaemonResponse)
          : d,
      ),
    );

    try {
      await this.pamApi.assignRotationDaemon(orgId, daemon.id, {
        targetSystemId,
      } as import("@bitwarden/bit-pam").DaemonAssignmentRequest);
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
  async unassign(daemon: RotationDaemonResponse, targetSystemId: string): Promise<void> {
    const orgId = this.requireOrganizationId();
    const prevDaemons = this._daemons$.value;

    // Optimistic update
    this._daemons$.next(
      prevDaemons.map((d) =>
        d.id === daemon.id
          ? ({
              ...d,
              assignments: d.assignments.filter((id) => id !== targetSystemId),
            } as RotationDaemonResponse)
          : d,
      ),
    );

    try {
      await this.pamApi.unassignRotationDaemon(orgId, daemon.id, targetSystemId);
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
    daemons: RotationDaemonResponse[],
    systemById: Map<string, import("@bitwarden/bit-pam").TargetSystemResponse>,
  ): DaemonRow[] {
    return daemons.map((daemon) => ({
      id: daemon.id,
      name: daemon.name,
      statusLabelKey:
        daemon.status === DaemonStatus.Enrolled
          ? "pamDaemonStatusEnrolled"
          : "pamDaemonStatusRevoked",
      isConnected: daemon.isConnected,
      assignmentNames: daemon.assignments.map((id) => systemById.get(id)?.name ?? id),
      canRevoke: daemon.status === DaemonStatus.Enrolled,
      canAssign: daemon.status === DaemonStatus.Enrolled,
      daemon,
    }));
  }
}
