import { Injectable, inject } from "@angular/core";
import { BehaviorSubject, Observable, combineLatest, map } from "rxjs";

import { OrganizationId } from "@bitwarden/common/types/guid";

import { TargetSystemId, TargetSystemMethod, TargetSystemStatus, TargetSystem } from "../rotation";
import { RotationSdkService } from "../rotation-sdk.service";

/**
 * Data service for the target systems, provided at the rotation shell route so the tabs share one
 * load. Mutations patch local state only after the server confirms.
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

  readonly systemById$: Observable<Map<TargetSystemId, TargetSystem>> = this._systems$.pipe(
    map((systems) => new Map(systems.map((s) => [s.id, s]))),
  );

  /**
   * The systems an access connector can be assigned to. Status is not considered, as in
   * `AssignAccessConnectorToTargetCommand`; a new rotation config also needs an active target.
   */
  readonly automaticSystems$: Observable<TargetSystem[]> = combineLatest([this._systems$]).pipe(
    map(([systems]) => systems.filter((s) => s.method === TargetSystemMethod.Automatic)),
  );

  /**
   * Records a failure on {@link loadError$} rather than rejecting, so awaiting callers must read it
   * to tell a failed load from an empty one. Several tabs share this instance, so a superseded
   * call records nothing.
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

  /** The server answers with no content, so the status is patched locally once it confirms. */
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

  /** Not optimistic, since the server often refuses while a rotation config names the target. */
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
