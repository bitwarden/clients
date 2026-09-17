import { TestBed } from "@angular/core/testing";
import { BehaviorSubject } from "rxjs";

import { OrganizationId } from "@bitwarden/common/types/guid";

import type { AccessConnector, TargetSystemId, TargetSystem } from "../rotation";
import { AccessConnectorStatus } from "../rotation";
import { RotationSdkService } from "../rotation-sdk.service";
import { TargetSystemsService } from "../target-systems/target-systems.service";
import { deferred } from "../testing/deferred";
import { ORGANIZATION_ID, connectorId, sysId } from "../testing/rotation-builders";

import { AccessConnectorsService } from "./access-connectors.service";

const orgId = ORGANIZATION_ID as OrganizationId;

function makeAccessConnector(overrides: Partial<AccessConnector> = {}): AccessConnector {
  return {
    id: connectorId("access-connector-1"),
    name: "My access connector",
    status: AccessConnectorStatus.Enabled,
    isConnected: true,
    assignedTargetSystemIds: [],
    ...overrides,
  } as unknown as AccessConnector;
}

function makeTargetSystem(id: TargetSystemId, name: string): TargetSystem {
  return { id, name } as unknown as TargetSystem;
}

describe("AccessConnectorsService", () => {
  let service: AccessConnectorsService;
  let rotationSdk: jest.Mocked<RotationSdkService>;
  let targetSystemsService: jest.Mocked<TargetSystemsService>;
  let systemById$: BehaviorSubject<Map<TargetSystemId, TargetSystem>>;
  let targetSystemsLoadError$: BehaviorSubject<unknown | null>;

  beforeEach(() => {
    systemById$ = new BehaviorSubject<Map<TargetSystemId, TargetSystem>>(new Map());
    targetSystemsLoadError$ = new BehaviorSubject<unknown | null>(null);

    rotationSdk = {
      listConnectors: jest.fn().mockResolvedValue([]),
      enableConnector: jest.fn().mockResolvedValue(undefined),
      disableConnector: jest.fn().mockResolvedValue(undefined),
      deleteConnector: jest.fn().mockResolvedValue(undefined),
      assignTarget: jest.fn().mockResolvedValue(undefined),
      unassignTarget: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<RotationSdkService>;

    targetSystemsService = {
      systemById$: systemById$.asObservable(),
      loadError$: targetSystemsLoadError$.asObservable(),
    } as unknown as jest.Mocked<TargetSystemsService>;

    TestBed.configureTestingModule({
      providers: [
        AccessConnectorsService,
        { provide: RotationSdkService, useValue: rotationSdk },
        { provide: TargetSystemsService, useValue: targetSystemsService },
      ],
    });

    service = TestBed.inject(AccessConnectorsService);
  });

  describe("load", () => {
    it("populates accessConnectors from the API", async () => {
      const accessConnectors = [makeAccessConnector()];
      rotationSdk.listConnectors.mockResolvedValue(accessConnectors);

      await service.load(orgId);

      const rows = await firstValue(service.rows$);
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(connectorId("access-connector-1"));
    });

    it("sets loading to false after load", async () => {
      await service.load(orgId);
      const loading = await firstValue(service.loading$);
      expect(loading).toBe(false);
    });

    it("records the failure and clears loading when the API throws", async () => {
      const failure = new Error("network fail");
      rotationSdk.listConnectors.mockRejectedValue(failure);

      await expect(service.load(orgId)).resolves.toBeUndefined();

      expect(await firstValue(service.loading$)).toBe(false);
      expect(await firstValue(service.loadError$)).toBe(failure);
    });

    it("clears a previous failure at the start of the next load", async () => {
      rotationSdk.listConnectors.mockRejectedValueOnce(new Error("network fail"));
      await service.load(orgId);
      rotationSdk.listConnectors.mockResolvedValue([makeAccessConnector()]);

      await service.load(orgId);

      expect(await firstValue(service.loadError$)).toBeNull();
    });

    it("does not latch a concurrent load's failure over a later success", async () => {
      rotationSdk.listConnectors
        .mockRejectedValueOnce(new Error("network fail"))
        .mockResolvedValueOnce([makeAccessConnector()]);

      const failing = service.load(orgId);
      const succeeding = service.load(orgId);
      await Promise.all([failing, succeeding]);

      expect(await firstValue(service.rows$)).toHaveLength(1);
      expect(await firstValue(service.loadError$)).toBeNull();
    });

    it("does not let a superseded load's failure land over the current load's success", async () => {
      const gate = deferred();
      rotationSdk.listConnectors
        .mockImplementationOnce(async () => {
          await gate.promise;
          throw new Error("network fail");
        })
        .mockResolvedValueOnce([makeAccessConnector()]);

      const superseded = service.load(orgId);
      await service.load(orgId);
      gate.settle();
      await superseded;

      expect(await firstValue(service.rows$)).toHaveLength(1);
      expect(await firstValue(service.loadError$)).toBeNull();
      expect(await firstValue(service.loading$)).toBe(false);
    });

    it("reports a target-systems failure even when the accessConnector list loads", async () => {
      const failure = new Error("target systems fail");

      await service.load(orgId);
      targetSystemsLoadError$.next(failure);

      expect(await firstValue(service.loadError$)).toBe(failure);
    });
  });

  describe("rows$ projection", () => {
    it("resolves assignment IDs to target system names", async () => {
      const system = makeTargetSystem(sysId("ts-1"), "Production DB");
      systemById$.next(new Map([[sysId("ts-1"), system]]));
      rotationSdk.listConnectors.mockResolvedValue([
        makeAccessConnector({ assignedTargetSystemIds: [sysId("ts-1")] }),
      ]);

      await service.load(orgId);
      const rows = await firstValue(service.rows$);
      expect(rows[0].assignmentNames).toEqual(["Production DB"]);
    });

    it("falls back to the raw ID when a target system is not found", async () => {
      rotationSdk.listConnectors.mockResolvedValue([
        makeAccessConnector({ assignedTargetSystemIds: [sysId("unknown-id")] }),
      ]);

      await service.load(orgId);
      const rows = await firstValue(service.rows$);
      expect(rows[0].assignmentNames).toEqual([String(sysId("unknown-id"))]);
    });

    it("sets enabled and canAssign true for enabled accessConnectors", async () => {
      rotationSdk.listConnectors.mockResolvedValue([
        makeAccessConnector({ status: AccessConnectorStatus.Enabled }),
      ]);
      await service.load(orgId);
      const rows = await firstValue(service.rows$);
      expect(rows[0].enabled).toBe(true);
      expect(rows[0].canAssign).toBe(true);
    });

    it("sets enabled and canAssign false for disabled accessConnectors", async () => {
      rotationSdk.listConnectors.mockResolvedValue([
        makeAccessConnector({ status: AccessConnectorStatus.Disabled }),
      ]);
      await service.load(orgId);
      const rows = await firstValue(service.rows$);
      expect(rows[0].enabled).toBe(false);
      expect(rows[0].canAssign).toBe(false);
    });

    it("uses pamAccessConnectorStatusActive key for enabled connectors", async () => {
      rotationSdk.listConnectors.mockResolvedValue([
        makeAccessConnector({ status: AccessConnectorStatus.Enabled }),
      ]);
      await service.load(orgId);
      const rows = await firstValue(service.rows$);
      expect(rows[0].statusLabelKey).toBe("pamAccessConnectorStatusActive");
    });

    it("uses pamAccessConnectorStatusInactive key for disabled connectors", async () => {
      rotationSdk.listConnectors.mockResolvedValue([
        makeAccessConnector({ status: AccessConnectorStatus.Disabled }),
      ]);
      await service.load(orgId);
      const rows = await firstValue(service.rows$);
      expect(rows[0].statusLabelKey).toBe("pamAccessConnectorStatusInactive");
    });
  });

  describe("setEnabled", () => {
    it("disables via the API and patches status", async () => {
      const accessConnector = makeAccessConnector({ status: AccessConnectorStatus.Enabled });
      rotationSdk.listConnectors.mockResolvedValue([accessConnector]);
      await service.load(orgId);

      await service.setEnabled(accessConnector, false);

      const rows = await firstValue(service.rows$);
      expect(rows[0].enabled).toBe(false);
      expect(rotationSdk.disableConnector).toHaveBeenCalledWith(orgId, accessConnector.id);
    });

    it("enables via the API and patches status", async () => {
      const accessConnector = makeAccessConnector({ status: AccessConnectorStatus.Disabled });
      rotationSdk.listConnectors.mockResolvedValue([accessConnector]);
      await service.load(orgId);

      await service.setEnabled(accessConnector, true);

      const rows = await firstValue(service.rows$);
      expect(rows[0].enabled).toBe(true);
      expect(rotationSdk.enableConnector).toHaveBeenCalledWith(orgId, accessConnector.id);
    });

    it("rolls back on API failure", async () => {
      const accessConnector = makeAccessConnector({ status: AccessConnectorStatus.Enabled });
      rotationSdk.listConnectors.mockResolvedValue([accessConnector]);
      rotationSdk.disableConnector.mockRejectedValue(new Error("fail"));
      await service.load(orgId);

      await expect(service.setEnabled(accessConnector, false)).rejects.toThrow();

      const rows = await firstValue(service.rows$);
      expect(rows[0].enabled).toBe(true);
    });
  });

  describe("delete", () => {
    it("calls API and removes the accessConnector from local state", async () => {
      const accessConnector = makeAccessConnector({ id: connectorId("access-connector-1") });
      rotationSdk.listConnectors.mockResolvedValue([
        accessConnector,
        makeAccessConnector({ id: connectorId("access-connector-2") }),
      ]);
      await service.load(orgId);

      await service.delete(accessConnector);

      const rows = await firstValue(service.rows$);
      expect(rows.map((r) => r.id)).toEqual([connectorId("access-connector-2")]);
      expect(rotationSdk.deleteConnector).toHaveBeenCalledWith(orgId, accessConnector.id);
    });
  });

  describe("forgetTargetSystem", () => {
    it("removes the target from every accessConnector that had it assigned", async () => {
      rotationSdk.listConnectors.mockResolvedValue([
        makeAccessConnector({
          id: connectorId("access-connector-1"),
          assignedTargetSystemIds: [sysId("ts-1"), sysId("ts-2")],
        }),
        makeAccessConnector({
          id: connectorId("access-connector-2"),
          assignedTargetSystemIds: [sysId("ts-1")],
        }),
      ]);
      await service.load(orgId);

      service.forgetTargetSystem(sysId("ts-1"));

      const rows = await firstValue(service.rows$);
      expect(rows[0].accessConnector.assignedTargetSystemIds).toEqual([sysId("ts-2")]);
      expect(rows[1].accessConnector.assignedTargetSystemIds).toEqual([]);
    });

    it("leaves accessConnectors without that assignment untouched", async () => {
      const untouched = makeAccessConnector({
        id: connectorId("access-connector-1"),
        assignedTargetSystemIds: [sysId("ts-2")],
      });
      rotationSdk.listConnectors.mockResolvedValue([untouched]);
      await service.load(orgId);

      service.forgetTargetSystem(sysId("ts-1"));

      const rows = await firstValue(service.rows$);
      expect(rows[0].accessConnector).toBe(untouched);
    });

    it("does not reach the server — the delete already took the assignments", async () => {
      rotationSdk.listConnectors.mockResolvedValue([
        makeAccessConnector({ assignedTargetSystemIds: [sysId("ts-1")] }),
      ]);
      await service.load(orgId);

      service.forgetTargetSystem(sysId("ts-1"));

      expect(rotationSdk.unassignTarget).not.toHaveBeenCalled();
    });
  });

  describe("assign", () => {
    it("optimistically adds the target system ID", async () => {
      const accessConnector = makeAccessConnector({ assignedTargetSystemIds: [] });
      rotationSdk.listConnectors.mockResolvedValue([accessConnector]);
      await service.load(orgId);

      await service.assign(accessConnector, sysId("ts-99"));

      const rows = await firstValue(service.rows$);
      expect(rows[0].accessConnector.assignedTargetSystemIds).toContain(sysId("ts-99"));
    });

    it("rolls back on API failure", async () => {
      const accessConnector = makeAccessConnector({ assignedTargetSystemIds: [] });
      rotationSdk.listConnectors.mockResolvedValue([accessConnector]);
      rotationSdk.assignTarget.mockRejectedValue(new Error("fail"));
      await service.load(orgId);

      await expect(service.assign(accessConnector, sysId("ts-99"))).rejects.toThrow();

      const rows = await firstValue(service.rows$);
      expect(rows[0].accessConnector.assignedTargetSystemIds).not.toContain(sysId("ts-99"));
    });
  });

  describe("unassign", () => {
    it("optimistically removes the target system ID", async () => {
      const accessConnector = makeAccessConnector({ assignedTargetSystemIds: [sysId("ts-1")] });
      rotationSdk.listConnectors.mockResolvedValue([accessConnector]);
      await service.load(orgId);

      await service.unassign(accessConnector, sysId("ts-1"));

      const rows = await firstValue(service.rows$);
      expect(rows[0].accessConnector.assignedTargetSystemIds).not.toContain(sysId("ts-1"));
    });

    it("rolls back on API failure", async () => {
      const accessConnector = makeAccessConnector({ assignedTargetSystemIds: [sysId("ts-1")] });
      rotationSdk.listConnectors.mockResolvedValue([accessConnector]);
      rotationSdk.unassignTarget.mockRejectedValue(new Error("fail"));
      await service.load(orgId);

      await expect(service.unassign(accessConnector, sysId("ts-1"))).rejects.toThrow();

      const rows = await firstValue(service.rows$);
      expect(rows[0].accessConnector.assignedTargetSystemIds).toContain(sysId("ts-1"));
    });
  });

  describe("registerCompleted", () => {
    it("re-loads accessConnectors from the API", async () => {
      await service.load(orgId);
      rotationSdk.listConnectors.mockClear();
      rotationSdk.listConnectors.mockResolvedValue([]);

      await service.registerCompleted(orgId);

      expect(rotationSdk.listConnectors).toHaveBeenCalledTimes(1);
    });
  });
});

// Helper to get the current value of an observable synchronously.
function firstValue<T>(obs: import("rxjs").Observable<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    obs.subscribe({ next: resolve, error: reject }).unsubscribe();
  });
}
