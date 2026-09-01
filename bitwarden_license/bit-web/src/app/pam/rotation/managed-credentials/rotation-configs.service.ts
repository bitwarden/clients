import { Injectable, inject } from "@angular/core";
import { BehaviorSubject, Observable, combineLatest, map, switchMap } from "rxjs";

import { OrganizationId } from "@bitwarden/common/types/guid";

import { OrgCiphersService } from "../org-ciphers.service";
import { RotationConfigId, RotationConfig } from "../rotation";
import { RotationSdkService } from "../rotation-sdk.service";
import { TargetSystemsService } from "../target-systems/target-systems.service";

import { RotationConfigRow, buildRotationConfigRow } from "./rotation-config-row";

/**
 * Page-scoped data service for the managed-credentials tab.
 *
 * Provided at the rotation shell route so all rotation tabs share one loaded instance.
 * Owns the rotation config list, joins target systems and cipher names, and performs
 * mutations with optimistic local patching (rollback + rethrow on error).
 */
@Injectable()
export class RotationConfigsService {
  private readonly rotationSdk = inject(RotationSdkService);
  private readonly targetSystems = inject(TargetSystemsService);
  private readonly orgCiphers = inject(OrgCiphersService);

  /** Set by {@link load}; the org all subsequent mutations target. */
  private organizationId: OrganizationId | null = null;

  private readonly _configs$ = new BehaviorSubject<RotationConfig[]>([]);
  private readonly _loading$ = new BehaviorSubject<boolean>(true);

  readonly configs$: Observable<RotationConfig[]> = this._configs$.asObservable();
  readonly loading$: Observable<boolean> = this._loading$.asObservable();

  /** Count of configs currently awaiting a manual rotation from the operator. */
  readonly awaitingManualCount$: Observable<number> = this._configs$.pipe(
    map((configs) => configs.filter((c) => c.awaitingManualRotation).length),
  );

  /**
   * Rotation configs projected into presentation rows, joined with resolved target
   * systems and cipher names. Updates whenever any of the three sources changes.
   */
  readonly rows$: Observable<RotationConfigRow[]> = combineLatest([
    this._configs$,
    this.targetSystems.systemById$,
    this.orgCiphers.cipherNameById$,
  ]).pipe(
    // `switchMap`, not `concatMap`: each emission describes the whole list, so a newer one wholly
    // supersedes an in-flight older one and there is nothing to preserve by queueing.
    switchMap(async ([configs, systemById, cipherNameById]) => {
      const descriptions = await this.rotationSdk.describeConfigs(
        configs,
        new Map([...systemById].map(([id, system]) => [id, system.status])),
      );
      return configs.flatMap((config) => {
        const description = descriptions.get(config.id);
        // `describeConfigs` returns one entry per config it was handed, so a miss means the list
        // changed underneath this pass; drop the row rather than render it with no actions, and
        // let the next emission carry it.
        return description
          ? [
              buildRotationConfigRow(
                config,
                systemById.get(config.targetSystemId),
                cipherNameById.get(config.cipherId),
                description,
              ),
            ]
          : [];
      });
    }),
  );

  /**
   * Load the org's rotation configs and kick off sibling loads for target systems and
   * org ciphers in parallel. All three fetches must complete before the loading spinner
   * clears — the rows depend on all three.
   */
  async load(organizationId: OrganizationId): Promise<void> {
    this.organizationId = organizationId;
    this._loading$.next(true);
    try {
      const [configs] = await Promise.all([
        this.rotationSdk.listConfigs(organizationId),
        this.targetSystems.load(organizationId),
        this.orgCiphers.load(organizationId),
      ]);
      this._configs$.next(configs);
    } finally {
      this._loading$.next(false);
    }
  }

  /**
   * Pause a rotation config (set enabled = false).
   * Optimistically patches local state; rolls back + rethrows on API failure.
   */
  async pause(config: RotationConfig): Promise<void> {
    this.patchConfig(config.id, { enabled: false });
    try {
      await this.rotationSdk.pauseConfig(this.requireOrganizationId(), config.id);
    } catch (e) {
      this.patchConfig(config.id, { enabled: true });
      throw e;
    }
  }

  /**
   * Resume a rotation config (set enabled = true).
   * Optimistically patches local state; rolls back + rethrows on API failure.
   */
  async resume(config: RotationConfig): Promise<void> {
    this.patchConfig(config.id, { enabled: true });
    try {
      await this.rotationSdk.resumeConfig(this.requireOrganizationId(), config.id);
    } catch (e) {
      this.patchConfig(config.id, { enabled: false });
      throw e;
    }
  }

  /**
   * Dispatch an on-demand rotation for a config.
   * Optimistically sets hasActiveJob = true so the row reflects the in-progress state
   * immediately. Does not roll back on error — the list will re-reflect truth on next load.
   */
  async rotateNow(config: RotationConfig): Promise<void> {
    await this.rotationSdk.rotateNow(this.requireOrganizationId(), config.id);
    this.patchConfig(config.id, { hasActiveJob: true });
  }

  /**
   * Record that a manual rotation was performed out-of-band.
   * Optimistically clears awaitingManualRotation and sets lastRotationAt to now.
   * Rolls back + rethrows on API failure.
   */
  async recordManual(config: RotationConfig): Promise<void> {
    const previousAwaitingManual = config.awaitingManualRotation;
    const previousLastRotationAt = config.lastRotationAt;
    this.patchConfig(config.id, {
      awaitingManualRotation: false,
      lastRotationAt: new Date().toISOString(),
    });
    try {
      await this.rotationSdk.recordManualRotation(this.requireOrganizationId(), config.id);
    } catch (e) {
      this.patchConfig(config.id, {
        awaitingManualRotation: previousAwaitingManual,
        lastRotationAt: previousLastRotationAt,
      });
      throw e;
    }
  }

  /**
   * Delete a rotation config, removing it from local state.
   * Does not optimistically patch — waits for the server to confirm before removing.
   * Rolls back is implicit: if the API throws, _configs$ is unchanged.
   */
  async delete(config: RotationConfig): Promise<void> {
    await this.rotationSdk.deleteConfig(this.requireOrganizationId(), config.id);
    this._configs$.next(this._configs$.value.filter((c) => c.id !== config.id));
  }

  private requireOrganizationId(): OrganizationId {
    if (this.organizationId == null) {
      throw new Error("RotationConfigsService.load must run before mutating configs.");
    }
    return this.organizationId;
  }

  /**
   * Apply a partial patch to the config with the given id in the local stream.
   * Creates a new object (preserves reference-equality semantics for OnPush).
   */
  private patchConfig(id: RotationConfigId, patch: Partial<RotationConfig>): void {
    this._configs$.next(
      this._configs$.value.map((c) =>
        // A view crosses the WASM boundary as a plain object, so a spread is a faithful copy —
        // there is no prototype to preserve, unlike the BaseResponse instances this replaced.
        c.id === id ? { ...c, ...patch } : c,
      ),
    );
  }
}
