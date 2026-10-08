import { Injectable, inject } from "@angular/core";
import { BehaviorSubject, Observable, combineLatest, map, switchMap } from "rxjs";

import { OrganizationId } from "@bitwarden/common/types/guid";

import { OrgCiphersService } from "../org-ciphers.service";
import { RotationConfigId, RotationConfig } from "../rotation";
import { RotationSdkService } from "../rotation-sdk.service";
import { TargetSystemsService } from "../target-systems/target-systems.service";

import { RotationConfigRow, buildRotationConfigRow } from "./rotation-config-row";

/**
 * Data service for the managed credentials tab, provided at the rotation shell route so the tabs
 * share one load. Pause, resume and record-manual patch local state first and roll back on failure.
 */
@Injectable()
export class RotationConfigsService {
  private readonly rotationSdk = inject(RotationSdkService);
  private readonly targetSystems = inject(TargetSystemsService);
  private readonly orgCiphers = inject(OrgCiphersService);

  /** Set by {@link load}; the org all subsequent mutations target. */
  private organizationId: OrganizationId | null = null;

  /** Incremented per {@link load} call so a superseded call can drop its outcome. */
  private loadGeneration = 0;

  private readonly _configs$ = new BehaviorSubject<RotationConfig[]>([]);
  private readonly _loading$ = new BehaviorSubject<boolean>(true);
  private readonly _loadError$ = new BehaviorSubject<unknown | null>(null);

  readonly configs$: Observable<RotationConfig[]> = this._configs$.asObservable();
  readonly loading$: Observable<boolean> = this._loading$.asObservable();

  /** This list's load error, else the target-system read's; null when both succeeded. */
  readonly loadError$: Observable<unknown | null> = combineLatest([
    this._loadError$,
    this.targetSystems.loadError$,
  ]).pipe(map(([own, targetSystemsError]) => own ?? targetSystemsError));

  readonly awaitingManualCount$: Observable<number> = this._configs$.pipe(
    map((configs) => configs.filter((c) => c.awaitingManualRotation).length),
  );

  readonly rows$: Observable<RotationConfigRow[]> = combineLatest([
    this._configs$,
    this.targetSystems.systemById$,
    this.orgCiphers.cipherNameById$,
  ]).pipe(
    // `switchMap`, not `concatMap`: a newer emission wholly supersedes an in-flight older one.
    switchMap(async ([configs, systemById, cipherNameById]) => {
      const descriptions = await this.rotationSdk.describeConfigs(
        configs,
        new Map([...systemById].map(([id, system]) => [id, system.status])),
      );
      return configs.flatMap((config) => {
        const description = descriptions.get(config.id);
        // A miss means the list changed underneath this pass; drop the row rather than render it
        // with no actions.
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
   * Loading clears once the configs, target systems and ciphers have all landed, since rows need
   * all three. Records a failure on {@link loadError$} rather than rejecting, and a superseded call
   * records nothing.
   */
  async load(organizationId: OrganizationId): Promise<void> {
    this.organizationId = organizationId;
    const generation = ++this.loadGeneration;
    this._loading$.next(true);
    this._loadError$.next(null);
    try {
      const [configs] = await Promise.all([
        this.rotationSdk.listConfigs(organizationId),
        this.targetSystems.load(organizationId),
        this.orgCiphers.load(organizationId),
      ]);
      if (generation !== this.loadGeneration) {
        return;
      }
      this._configs$.next(configs);
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

  async pause(config: RotationConfig): Promise<void> {
    this.patchConfig(config.id, { enabled: false });
    try {
      await this.rotationSdk.pauseConfig(this.requireOrganizationId(), config.id);
    } catch (e) {
      this.patchConfig(config.id, { enabled: true });
      throw e;
    }
  }

  async resume(config: RotationConfig): Promise<void> {
    this.patchConfig(config.id, { enabled: true });
    try {
      await this.rotationSdk.resumeConfig(this.requireOrganizationId(), config.id);
    } catch (e) {
      this.patchConfig(config.id, { enabled: false });
      throw e;
    }
  }

  /** Sets `hasActiveJob` once the server accepts, so the row shows the job without a reload. */
  async rotateNow(config: RotationConfig): Promise<void> {
    await this.rotationSdk.rotateNow(this.requireOrganizationId(), config.id);
    this.patchConfig(config.id, { hasActiveJob: true });
  }

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

  private patchConfig(id: RotationConfigId, patch: Partial<RotationConfig>): void {
    this._configs$.next(
      this._configs$.value.map((c) =>
        // A view crosses the WASM boundary as a plain object, so a spread is a faithful copy.
        c.id === id ? { ...c, ...patch } : c,
      ),
    );
  }
}
