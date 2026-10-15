import { TestBed } from "@angular/core/testing";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import type { CipherId } from "@bitwarden/sdk-internal";

import { AccessConnectorsService } from "../access-connectors/access-connectors.service";
import { OrgCiphersService } from "../org-ciphers.service";
import type {
  AccessConnector,
  RotationConfigView,
  TargetSystemId,
  TargetSystemStatus,
  TargetSystemView,
} from "../rotation";
import { RotationSdkService } from "../rotation-sdk.service";
import { TargetSystemsService } from "../target-systems/target-systems.service";
import { deferred } from "../testing/deferred";
import {
  CIPHER_ID,
  ORGANIZATION_ID,
  ROTATION_CONFIG_ID,
  TARGET_SYSTEM_ID,
  accessConnector,
  rotationConfigDescription,
  rotationConfig,
  targetSystem,
} from "../testing/rotation-builders";

import { RotationConfigsService } from "./rotation-configs.service";

const ORG_ID = ORGANIZATION_ID;

describe("RotationConfigsService", () => {
  let service: RotationConfigsService;
  let rotationSdk: jest.Mocked<
    Pick<
      RotationSdkService,
      | "listConfigs"
      | "pauseConfig"
      | "resumeConfig"
      | "rotateNow"
      | "recordManualRotation"
      | "deleteConfig"
      | "describeConfigs"
    >
  >;
  let targetSystemsService: {
    systemById$: BehaviorSubject<Map<TargetSystemId, TargetSystemView>>;
    load: jest.Mock;
    systems$: BehaviorSubject<TargetSystemView[]>;
    loading$: BehaviorSubject<boolean>;
    loadError$: BehaviorSubject<unknown | null>;
  };
  let orgCiphersService: {
    cipherNameById$: BehaviorSubject<Map<CipherId, string>>;
    load: jest.Mock;
    ciphers$: BehaviorSubject<CipherView[]>;
    loading$: BehaviorSubject<boolean>;
  };

  let accessConnectorsService: {
    accessConnectors$: BehaviorSubject<AccessConnector[]>;
    loading$: BehaviorSubject<boolean>;
    loadError$: BehaviorSubject<unknown | null>;
  };

  beforeEach(() => {
    const config = rotationConfig();
    const target = targetSystem();

    rotationSdk = {
      listConfigs: jest.fn().mockResolvedValue([config]),
      pauseConfig: jest.fn().mockResolvedValue(undefined),
      resumeConfig: jest.fn().mockResolvedValue(undefined),
      rotateNow: jest.fn().mockResolvedValue(undefined),
      recordManualRotation: jest.fn().mockResolvedValue(undefined),
      deleteConfig: jest.fn().mockResolvedValue(undefined),
      // Typed like the real method so jest infers the mock's signature.
      describeConfigs: jest.fn(
        async (
          configs: readonly RotationConfigView[],
          _targetStatusById: ReadonlyMap<TargetSystemId, TargetSystemStatus>,
        ) => new Map(configs.map((c) => [c.id, rotationConfigDescription()])),
      ),
    };

    targetSystemsService = {
      systemById$: new BehaviorSubject(new Map([[target.id, target]])),
      load: jest.fn().mockResolvedValue(undefined),
      systems$: new BehaviorSubject([target]),
      loading$: new BehaviorSubject(false),
      loadError$: new BehaviorSubject<unknown | null>(null),
    };

    orgCiphersService = {
      cipherNameById$: new BehaviorSubject<Map<CipherId, string>>(
        new Map([[CIPHER_ID, "My Cipher"]]),
      ),
      load: jest.fn().mockResolvedValue(undefined),
      ciphers$: new BehaviorSubject([] as CipherView[]),
      loading$: new BehaviorSubject(false),
    };

    accessConnectorsService = {
      accessConnectors$: new BehaviorSubject<AccessConnector[]>([
        accessConnector({ assignedTargetSystemIds: [TARGET_SYSTEM_ID] }),
      ]),
      loading$: new BehaviorSubject(false),
      loadError$: new BehaviorSubject<unknown | null>(null),
    };

    TestBed.configureTestingModule({
      providers: [
        RotationConfigsService,
        { provide: AccessConnectorsService, useValue: accessConnectorsService },
        { provide: RotationSdkService, useValue: rotationSdk },
        { provide: TargetSystemsService, useValue: targetSystemsService },
        { provide: OrgCiphersService, useValue: orgCiphersService },
      ],
    });
    service = TestBed.inject(RotationConfigsService);
  });

  it("loads configs and kicks off sibling loads in parallel", async () => {
    await service.load(ORG_ID);
    expect(rotationSdk.listConfigs).toHaveBeenCalledWith(ORG_ID);
    expect(targetSystemsService.load).toHaveBeenCalledWith(ORG_ID);
    expect(orgCiphersService.load).toHaveBeenCalledWith(ORG_ID);
  });

  it("records the failure and clears loading when listConfigs throws", async () => {
    const failure = new Error("network fail");
    rotationSdk.listConfigs.mockRejectedValue(failure);

    await expect(service.load(ORG_ID)).resolves.toBeUndefined();

    expect(await firstValueFrom(service.loading$)).toBe(false);
    expect(await firstValueFrom(service.loadError$)).toBe(failure);
  });

  it("clears a previous failure at the start of the next load", async () => {
    rotationSdk.listConfigs.mockRejectedValueOnce(new Error("network fail"));
    await service.load(ORG_ID);

    await service.load(ORG_ID);

    expect(await firstValueFrom(service.loadError$)).toBeNull();
  });

  it("does not latch a concurrent load's failure over a later success", async () => {
    rotationSdk.listConfigs
      .mockRejectedValueOnce(new Error("network fail"))
      .mockResolvedValueOnce([rotationConfig()]);

    const failing = service.load(ORG_ID);
    const succeeding = service.load(ORG_ID);
    await Promise.all([failing, succeeding]);

    expect(await firstValueFrom(service.configs$)).toHaveLength(1);
    expect(await firstValueFrom(service.loadError$)).toBeNull();
  });

  it("does not let a superseded load's success clear the current load's failure", async () => {
    const gate = deferred();
    const failure = new Error("network fail");
    rotationSdk.listConfigs
      .mockImplementationOnce(async () => {
        await gate.promise;
        return [rotationConfig()];
      })
      .mockRejectedValueOnce(failure);

    const superseded = service.load(ORG_ID);
    await service.load(ORG_ID);
    gate.settle();
    await superseded;

    expect(await firstValueFrom(service.configs$)).toHaveLength(0);
    expect(await firstValueFrom(service.loadError$)).toBe(failure);
    expect(await firstValueFrom(service.loading$)).toBe(false);
  });

  it("reports a target-systems failure as its own load error", async () => {
    const failure = new Error("target systems unavailable");
    targetSystemsService.loadError$.next(failure);

    await service.load(ORG_ID);

    expect(await firstValueFrom(service.loadError$)).toBe(failure);
  });

  it("exposes loaded configs via configs$", async () => {
    await service.load(ORG_ID);
    const configs = await firstValueFrom(service.configs$);
    expect(configs).toHaveLength(1);
    expect(configs[0].id).toBe(ROTATION_CONFIG_ID);
  });

  it("projects rows with cipher name from orgCiphers", async () => {
    await service.load(ORG_ID);
    const rows = await firstValueFrom(service.rows$);
    expect(rows[0].cipherName).toBe("My Cipher");
  });

  describe("not connected", () => {
    const statusOf = async () => {
      await service.load(ORG_ID);
      return (await firstValueFrom(service.rows$))[0].status;
    };

    it("reads active while a connected connector is assigned to the target", async () => {
      expect(await statusOf()).toBe("active");
    });

    it("reads not connected when no connector is assigned to the target", async () => {
      accessConnectorsService.accessConnectors$.next([]);
      expect(await statusOf()).toBe("not-connected");
    });

    it("withholds the verdict while the connector read is in flight", async () => {
      accessConnectorsService.accessConnectors$.next([]);
      accessConnectorsService.loading$.next(true);
      expect(await statusOf()).toBe("active");
    });

    it("withholds the verdict when the connector read failed", async () => {
      accessConnectorsService.accessConnectors$.next([]);
      accessConnectorsService.loadError$.next(new Error("boom"));
      expect(await statusOf()).toBe("active");
    });
  });

  describe("polling while a job runs", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it("re-reads the list until no row has a running job", async () => {
      rotationSdk.listConfigs
        .mockResolvedValueOnce([rotationConfig({ hasActiveJob: true })])
        .mockResolvedValueOnce([rotationConfig({ hasActiveJob: true })])
        .mockResolvedValue([rotationConfig({ hasActiveJob: false })]);
      await service.load(ORG_ID);
      expect(rotationSdk.listConfigs).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(5000);
      expect(rotationSdk.listConfigs).toHaveBeenCalledTimes(2);

      await jest.advanceTimersByTimeAsync(5000);
      expect(rotationSdk.listConfigs).toHaveBeenCalledTimes(3);
      expect((await firstValueFrom(service.configs$))[0].hasActiveJob).toBe(false);

      await jest.advanceTimersByTimeAsync(30000);
      expect(rotationSdk.listConfigs).toHaveBeenCalledTimes(3);
    });

    it("starts polling when rotate now marks a row as running", async () => {
      await service.load(ORG_ID);
      await service.rotateNow((await firstValueFrom(service.configs$))[0]);
      rotationSdk.listConfigs.mockResolvedValue([rotationConfig({ hasActiveJob: false })]);

      await jest.advanceTimersByTimeAsync(5000);

      expect((await firstValueFrom(service.configs$))[0].hasActiveJob).toBe(false);
    });

    it("does not poll when nothing is running", async () => {
      await service.load(ORG_ID);
      await jest.advanceTimersByTimeAsync(30000);
      expect(rotationSdk.listConfigs).toHaveBeenCalledTimes(1);
    });

    it("keeps polling after a failed re-read", async () => {
      rotationSdk.listConfigs
        .mockResolvedValueOnce([rotationConfig({ hasActiveJob: true })])
        .mockRejectedValueOnce(new Error("boom"))
        .mockResolvedValue([rotationConfig({ hasActiveJob: false })]);
      await service.load(ORG_ID);

      await jest.advanceTimersByTimeAsync(5000);
      await jest.advanceTimersByTimeAsync(5000);

      expect((await firstValueFrom(service.configs$))[0].hasActiveJob).toBe(false);
    });

    it("stops polling when the service is destroyed", async () => {
      rotationSdk.listConfigs.mockResolvedValue([rotationConfig({ hasActiveJob: true })]);
      await service.load(ORG_ID);

      service.ngOnDestroy();
      await jest.advanceTimersByTimeAsync(30000);

      expect(rotationSdk.listConfigs).toHaveBeenCalledTimes(1);
    });
  });

  it("awaitingManualCount$ counts configs awaiting manual rotation", async () => {
    rotationSdk.listConfigs.mockResolvedValue([rotationConfig({ awaitingManualRotation: true })]);
    await service.load(ORG_ID);
    const count = await firstValueFrom(service.awaitingManualCount$);
    expect(count).toBe(1);
  });

  it("pause optimistically sets enabled=false", async () => {
    await service.load(ORG_ID);
    const configs = await firstValueFrom(service.configs$);
    await service.pause(configs[0]);
    const updated = await firstValueFrom(service.configs$);
    expect(updated[0].enabled).toBe(false);
  });

  it("pause rolls back on API error", async () => {
    await service.load(ORG_ID);
    const configs = await firstValueFrom(service.configs$);
    rotationSdk.pauseConfig.mockRejectedValue(new Error("Server error"));
    await expect(service.pause(configs[0])).rejects.toThrow("Server error");
    const updated = await firstValueFrom(service.configs$);
    expect(updated[0].enabled).toBe(true);
  });

  it("resume optimistically sets enabled=true", async () => {
    rotationSdk.listConfigs.mockResolvedValue([rotationConfig({ enabled: false })]);
    await service.load(ORG_ID);
    const configs = await firstValueFrom(service.configs$);
    await service.resume(configs[0]);
    const updated = await firstValueFrom(service.configs$);
    expect(updated[0].enabled).toBe(true);
  });

  it("rotateNow sets hasActiveJob=true", async () => {
    await service.load(ORG_ID);
    const configs = await firstValueFrom(service.configs$);
    await service.rotateNow(configs[0]);
    const updated = await firstValueFrom(service.configs$);
    expect(updated[0].hasActiveJob).toBe(true);
  });

  it("recordManual clears awaitingManualRotation and sets lastRotationAt", async () => {
    rotationSdk.listConfigs.mockResolvedValue([rotationConfig({ awaitingManualRotation: true })]);
    await service.load(ORG_ID);
    const configs = await firstValueFrom(service.configs$);
    await service.recordManual(configs[0]);
    const updated = await firstValueFrom(service.configs$);
    expect(updated[0].awaitingManualRotation).toBe(false);
    expect(updated[0].lastRotationAt).toBeTruthy();
  });

  it("recordManual rolls back on API error", async () => {
    rotationSdk.listConfigs.mockResolvedValue([rotationConfig({ awaitingManualRotation: true })]);
    await service.load(ORG_ID);
    const configs = await firstValueFrom(service.configs$);
    rotationSdk.recordManualRotation.mockRejectedValue(new Error("fail"));
    await expect(service.recordManual(configs[0])).rejects.toThrow("fail");
    const updated = await firstValueFrom(service.configs$);
    expect(updated[0].awaitingManualRotation).toBe(true);
  });

  it("delete removes config from local state after API success", async () => {
    await service.load(ORG_ID);
    const configs = await firstValueFrom(service.configs$);
    await service.delete(configs[0]);
    const updated = await firstValueFrom(service.configs$);
    expect(updated).toHaveLength(0);
  });

  it("delete does not modify local state on API error", async () => {
    await service.load(ORG_ID);
    const configs = await firstValueFrom(service.configs$);
    rotationSdk.deleteConfig.mockRejectedValue(new Error("fail"));
    await expect(service.delete(configs[0])).rejects.toThrow("fail");
    const updated = await firstValueFrom(service.configs$);
    expect(updated).toHaveLength(1);
  });
});
