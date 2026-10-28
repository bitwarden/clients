import { Injectable, OnDestroy, inject } from "@angular/core";
import { BehaviorSubject, Observable, combineLatest, map, switchMap } from "rxjs";

import { OrganizationId } from "@bitwarden/common/types/guid";

import { AccessConnectorsService } from "../access-connectors/access-connectors.service";
import { OrgCiphersService } from "../org-ciphers.service";
import { AccessConnector, RotationConfigId, RotationConfigView } from "../rotation";
import { RotationSdkService } from "../rotation-sdk.service";
import { TargetSystemsService } from "../target-systems/target-systems.service";

import { RotationConfigRow, buildRotationConfigRow } from "./rotation-config-row";

const ACTIVE_JOB_POLL_MS = 5000;

/**
 * Data service for the managed credentials tab, provided at the rotation shell route so the tabs
 * share one load. Pause, resume and record-manual patch local state first and roll back on failure.
 */
@Injectable()
export class RotationConfigsService implements OnDestroy {
  private readonly rotationSdk = inject(RotationSdkService);
  private readonly targetSystems = inject(TargetSystemsService);
  private readonly orgCiphers = inject(OrgCiphersService);
  private readonly accessConnectorsService = inject(AccessConnectorsService);

  /** Set by {@link load}; the org all subsequent mutations target. */
  private organizationId: OrganizationId | null = null;

  /** Incremented per {@link load} call so a superseded call can drop its outcome. */
  private loadGeneration = 0;

  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly _configs$ = new BehaviorSubject<RotationConfigView[]>([]);
  private readonly _loading$ = new BehaviorSubject<boolean>(true);
  private readonly _loadError$ = new BehaviorSubject<unknown | null>(null);

  readonly configs$: Observable<RotationConfigView[]> = this._configs$.asObservable();
  readonly loading$: Observable<boolean> = this._loading$.asObservable();

  /** This list's load error, else the target-system read's; null when both succeeded. */
  readonly loadError$: Observable<unknown | null> = combineLatest([
    this._loadError$,
    this.targetSystems.loadError$,
  ]).pipe(map(([own, targetSystemsError]) => own ?? targetSystemsError));

  readonly awaitingManualCount$: Observable<number> = this._configs$.pipe(
    map((configs) => configs.filter((c) => c.awaitingManualRotation).length),
  );

  /**
   * The access connectors once read successfully, else `null`. An unread or failed list would
   * otherwise look like an org with no connectors and mark every automatic credential Not
   * connected.
   */
  private readonly connectorsIfKnown$: Observable<AccessConnector[] | null> = combineLatest([
    this.accessConnectorsService.accessConnectors$,
    this.accessConnectorsService.loading$,
    this.accessConnectorsService.loadError$,
  ]).pipe(map(([connectors, loading, error]) => (loading || error != null ? null : connectors)));

  readonly rows$: Observable<RotationConfigRow[]> = combineLatest([
    this._configs$,
    this.targetSystems.systemById$,
    this.orgCiphers.cipherNameById$,
    this.connectorsIfKnown$,
  ]).pipe(
    // `switchMap`, not `concatMap`: a newer emission wholly supersedes an in-flight older one.
    switchMap(async ([configs, systemById, cipherNameById, connectors]) => {
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
                connectors,
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
      this.setConfigs(configs);
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

  async pause(config: RotationConfigView): Promise<void> {
    this.patchConfig(config.id, { enabled: false });
    try {
      await this.rotationSdk.pauseConfig(this.requireOrganizationId(), config.id);
    } catch (e) {
      this.patchConfig(config.id, { enabled: true });
      throw e;
    }
  }

  async resume(config: RotationConfigView): Promise<void> {
    this.patchConfig(config.id, { enabled: true });
    try {
      await this.rotationSdk.resumeConfig(this.requireOrganizationId(), config.id);
    } catch (e) {
      this.patchConfig(config.id, { enabled: false });
      throw e;
    }
  }

  /** Sets `hasActiveJob` once the server accepts, so the row shows the job without a reload. */
  async rotateNow(config: RotationConfigView): Promise<void> {
    await this.rotationSdk.rotateNow(this.requireOrganizationId(), config.id);
    this.patchConfig(config.id, { hasActiveJob: true });
  }

  async recordManual(config: RotationConfigView): Promise<void> {
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

  async delete(config: RotationConfigView): Promise<void> {
    await this.rotationSdk.deleteConfig(this.requireOrganizationId(), config.id);
    this.setConfigs(this._configs$.value.filter((c) => c.id !== config.id));
  }

  private requireOrganizationId(): OrganizationId {
    if (this.organizationId == null) {
      throw new Error("RotationConfigsService.load must run before mutating configs.");
    }
    return this.organizationId;
  }

  private patchConfig(id: RotationConfigId, patch: Partial<RotationConfigView>): void {
    this.setConfigs(
      this._configs$.value.map((c) =>
        // A view crosses the WASM boundary as a plain object, so a spread is a faithful copy.
        c.id === id ? { ...c, ...patch } : c,
      ),
    );
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  private setConfigs(configs: RotationConfigView[]): void {
    this._configs$.next(configs);
    this.syncPolling();
  }

  /**
   * A running job finishes on the server with nothing pushed to the client, so the list is re-read
   * on a timer for as long as any row has one.
   */
  private syncPolling(): void {
    if (!this._configs$.value.some((c) => c.hasActiveJob)) {
      this.stopPolling();
      return;
    }
    this.pollTimer ??= setTimeout(() => void this.poll(), ACTIVE_JOB_POLL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer != null) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async poll(): Promise<void> {
    this.pollTimer = null;
    const organizationId = this.organizationId;
    if (organizationId == null) {
      return;
    }
    const generation = this.loadGeneration;
    try {
      const configs = await this.rotationSdk.listConfigs(organizationId);
      if (generation !== this.loadGeneration) {
        return;
      }
      this.setConfigs(configs);
    } catch {
      this.syncPolling();
    }
  }
}
