import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { OrganizationId } from "@bitwarden/common/types/guid";

import { TargetSystemMethod, TargetSystemStatus } from "../rotation";
import { RotationSdkService } from "../rotation-sdk.service";
import { ORGANIZATION_ID, sysId, targetSystem } from "../testing/rotation-builders";

import { TargetSystemsService } from "./target-systems.service";

const ORG_ID = ORGANIZATION_ID as OrganizationId;

describe("TargetSystemsService", () => {
  let rotationSdk: ReturnType<typeof mock<RotationSdkService>>;
  let service: TargetSystemsService;

  beforeEach(() => {
    rotationSdk = mock<RotationSdkService>();
    TestBed.configureTestingModule({
      providers: [TargetSystemsService, { provide: RotationSdkService, useValue: rotationSdk }],
    });
    service = TestBed.inject(TargetSystemsService);
  });

  describe("load", () => {
    it("sets loading true initially, then false after", async () => {
      const loadingStates: boolean[] = [];
      service.loading$.subscribe((v) => loadingStates.push(v));

      rotationSdk.listTargetSystems.mockResolvedValue([targetSystem()]);
      await service.load(ORG_ID);

      // initial true (from BehaviorSubject(true)), then false after resolve
      expect(loadingStates).toContain(false);
      expect(loadingStates[0]).toBe(true);
    });

    it("populates systems$ with the API response", async () => {
      const sys = targetSystem({ id: sysId("sys-abc") });
      rotationSdk.listTargetSystems.mockResolvedValue([sys]);
      await service.load(ORG_ID);

      const systems = await firstValueFrom(service.systems$);
      expect(systems).toHaveLength(1);
      expect(systems[0].id).toBe(sysId("sys-abc"));
    });

    it("records the failure and clears loading when the API throws", async () => {
      const failure = new Error("network fail");
      rotationSdk.listTargetSystems.mockRejectedValue(failure);

      await expect(service.load(ORG_ID)).resolves.toBeUndefined();

      expect(await firstValueFrom(service.loading$)).toBe(false);
      expect(await firstValueFrom(service.loadError$)).toBe(failure);
    });

    it("clears a previous failure at the start of the next load", async () => {
      rotationSdk.listTargetSystems.mockRejectedValueOnce(new Error("network fail"));
      await service.load(ORG_ID);
      rotationSdk.listTargetSystems.mockResolvedValue([targetSystem()]);

      await service.load(ORG_ID);

      expect(await firstValueFrom(service.loadError$)).toBeNull();
    });

    it("does not latch a concurrent load's failure over a later success", async () => {
      rotationSdk.listTargetSystems
        .mockRejectedValueOnce(new Error("network fail"))
        .mockResolvedValueOnce([targetSystem()]);

      const failing = service.load(ORG_ID);
      const succeeding = service.load(ORG_ID);
      await Promise.all([failing, succeeding]);

      expect(await firstValueFrom(service.systems$)).toHaveLength(1);
      expect(await firstValueFrom(service.loadError$)).toBeNull();
    });
  });

  describe("systemById$", () => {
    it("provides a Map keyed by id", async () => {
      const a = targetSystem({ id: sysId("a") });
      const b = targetSystem({ id: sysId("b") });
      rotationSdk.listTargetSystems.mockResolvedValue([a, b]);
      await service.load(ORG_ID);

      const map = await firstValueFrom(service.systemById$);
      expect(map.get(sysId("a"))).toBeDefined();
      expect(map.get(sysId("b"))).toBeDefined();
      expect(map.get(sysId("a"))!.id).toBe(sysId("a"));
    });
  });

  describe("automaticSystems$", () => {
    it("returns every Automatic system, whatever its status", async () => {
      const active = targetSystem({
        id: sysId("active"),
        status: TargetSystemStatus.Active,
        method: TargetSystemMethod.Automatic,
      });
      const disabled = targetSystem({
        id: sysId("disabled"),
        status: TargetSystemStatus.Disabled,
        method: TargetSystemMethod.Automatic,
      });
      const manual = targetSystem({
        id: sysId("manual"),
        status: TargetSystemStatus.Active,
        method: TargetSystemMethod.Manual,
        kind: null,
      });
      rotationSdk.listTargetSystems.mockResolvedValue([active, disabled, manual]);
      await service.load(ORG_ID);

      const result = await firstValueFrom(service.automaticSystems$);
      expect(result.map((s) => s.id)).toEqual([sysId("active"), sysId("disabled")]);
    });
  });

  describe("setEnabled", () => {
    beforeEach(async () => {
      rotationSdk.listTargetSystems.mockResolvedValue([
        targetSystem({ id: sysId("sys-1"), status: TargetSystemStatus.Active }),
      ]);
      await service.load(ORG_ID);
    });

    it("calls enableTargetSystem when enabling", async () => {
      rotationSdk.enableTargetSystem.mockResolvedValue(undefined);
      const sys = targetSystem({ id: sysId("sys-1"), status: TargetSystemStatus.Disabled });
      await service.setEnabled(sys, true);
      expect(rotationSdk.enableTargetSystem).toHaveBeenCalledWith(ORG_ID, sysId("sys-1"));
    });

    it("calls disableTargetSystem when disabling", async () => {
      rotationSdk.disableTargetSystem.mockResolvedValue(undefined);
      const sys = targetSystem({ id: sysId("sys-1"), status: TargetSystemStatus.Active });
      await service.setEnabled(sys, false);
      expect(rotationSdk.disableTargetSystem).toHaveBeenCalledWith(ORG_ID, sysId("sys-1"));
    });

    it("patches local status to Active when enabling", async () => {
      rotationSdk.enableTargetSystem.mockResolvedValue(undefined);
      const sys = targetSystem({ id: sysId("sys-1"), status: TargetSystemStatus.Disabled });
      await service.setEnabled(sys, true);

      const systems = await firstValueFrom(service.systems$);
      expect(systems[0].status).toBe(TargetSystemStatus.Active);
    });

    it("patches local status to Disabled when disabling", async () => {
      rotationSdk.disableTargetSystem.mockResolvedValue(undefined);
      const sys = targetSystem({ id: sysId("sys-1"), status: TargetSystemStatus.Active });
      await service.setEnabled(sys, false);

      const systems = await firstValueFrom(service.systems$);
      expect(systems[0].status).toBe(TargetSystemStatus.Disabled);
    });
  });

  describe("delete", () => {
    beforeEach(async () => {
      rotationSdk.listTargetSystems.mockResolvedValue([
        targetSystem({ id: sysId("sys-1") }),
        targetSystem({ id: sysId("sys-2") }),
      ]);
      await service.load(ORG_ID);
    });

    it("calls deleteTargetSystem with the org and target id", async () => {
      rotationSdk.deleteTargetSystem.mockResolvedValue(undefined);
      await service.delete(targetSystem({ id: sysId("sys-1") }));

      expect(rotationSdk.deleteTargetSystem).toHaveBeenCalledWith(ORG_ID, sysId("sys-1"));
    });

    it("drops only the deleted system from local state", async () => {
      rotationSdk.deleteTargetSystem.mockResolvedValue(undefined);
      await service.delete(targetSystem({ id: sysId("sys-1") }));

      const systems = await firstValueFrom(service.systems$);
      expect(systems.map((s) => s.id)).toEqual([sysId("sys-2")]);
    });

    it("keeps the system when the server refuses, and re-throws", async () => {
      // The server refuses while a rotation config still names the target; the row must stay.
      rotationSdk.deleteTargetSystem.mockRejectedValue(new Error("target system in use"));

      await expect(service.delete(targetSystem({ id: sysId("sys-1") }))).rejects.toThrow(
        "target system in use",
      );

      const systems = await firstValueFrom(service.systems$);
      expect(systems.map((s) => s.id)).toEqual([sysId("sys-1"), sysId("sys-2")]);
    });
  });
});
