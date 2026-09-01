import { TestBed } from "@angular/core/testing";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import type { CipherId } from "@bitwarden/sdk-internal";

import { OrgCiphersService } from "../org-ciphers.service";
import type {
  RotationConfigView,
  TargetSystemId,
  TargetSystemStatus,
  TargetSystemView,
} from "../rotation";
import { RotationSdkService } from "../rotation-sdk.service";
import { TargetSystemsService } from "../target-systems/target-systems.service";
import {
  CIPHER_ID,
  ORGANIZATION_ID,
  ROTATION_CONFIG_ID,
  rotationConfigDescription,
  rotationConfigView,
  targetSystemView,
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
  };
  let orgCiphersService: {
    cipherNameById$: BehaviorSubject<Map<CipherId, string>>;
    load: jest.Mock;
    ciphers$: BehaviorSubject<CipherView[]>;
    loading$: BehaviorSubject<boolean>;
  };

  beforeEach(() => {
    const config = rotationConfigView();
    const target = targetSystemView();

    rotationSdk = {
      listConfigs: jest.fn().mockResolvedValue([config]),
      pauseConfig: jest.fn().mockResolvedValue(undefined),
      resumeConfig: jest.fn().mockResolvedValue(undefined),
      rotateNow: jest.fn().mockResolvedValue(undefined),
      recordManualRotation: jest.fn().mockResolvedValue(undefined),
      deleteConfig: jest.fn().mockResolvedValue(undefined),
      // rows$ asks the SDK to derive each config's actions and schedule preset in one call.
      // Signature matches the contract exactly, so jest infers the mock rather than widening it.
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
    };

    orgCiphersService = {
      cipherNameById$: new BehaviorSubject<Map<CipherId, string>>(
        new Map([[CIPHER_ID, "My Cipher"]]),
      ),
      load: jest.fn().mockResolvedValue(undefined),
      ciphers$: new BehaviorSubject([] as CipherView[]),
      loading$: new BehaviorSubject(false),
    };

    TestBed.configureTestingModule({
      providers: [
        RotationConfigsService,
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

  it("awaitingManualCount$ counts configs awaiting manual rotation", async () => {
    rotationSdk.listConfigs.mockResolvedValue([
      rotationConfigView({ awaitingManualRotation: true }),
    ]);
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
    rotationSdk.listConfigs.mockResolvedValue([rotationConfigView({ enabled: false })]);
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
    rotationSdk.listConfigs.mockResolvedValue([
      rotationConfigView({ awaitingManualRotation: true }),
    ]);
    await service.load(ORG_ID);
    const configs = await firstValueFrom(service.configs$);
    await service.recordManual(configs[0]);
    const updated = await firstValueFrom(service.configs$);
    expect(updated[0].awaitingManualRotation).toBe(false);
    expect(updated[0].lastRotationAt).toBeTruthy();
  });

  it("recordManual rolls back on API error", async () => {
    rotationSdk.listConfigs.mockResolvedValue([
      rotationConfigView({ awaitingManualRotation: true }),
    ]);
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
