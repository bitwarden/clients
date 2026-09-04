import { TestBed } from "@angular/core/testing";
import { BehaviorSubject } from "rxjs";

import { OrganizationId } from "@bitwarden/common/types/guid";

import type { AccessConnector, TargetSystemId, TargetSystem } from "../rotation";
import { DaemonStatus } from "../rotation";
import { RotationSdkService } from "../rotation-sdk.service";
import { TargetSystemsService } from "../target-systems/target-systems.service";
import { ORGANIZATION_ID, connectorId, sysId } from "../testing/rotation-builders";

import { DaemonsService } from "./daemons.service";

const orgId = ORGANIZATION_ID as OrganizationId;

function makeDaemon(overrides: Partial<AccessConnector> = {}): AccessConnector {
  return {
    id: connectorId("daemon-1"),
    name: "My Daemon",
    status: DaemonStatus.Enabled,
    isConnected: true,
    assignedTargetSystemIds: [],
    ...overrides,
  } as unknown as AccessConnector;
}

function makeTargetSystem(id: TargetSystemId, name: string): TargetSystem {
  return { id, name } as unknown as TargetSystem;
}

describe("DaemonsService", () => {
  let service: DaemonsService;
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
        DaemonsService,
        { provide: RotationSdkService, useValue: rotationSdk },
        { provide: TargetSystemsService, useValue: targetSystemsService },
      ],
    });

    service = TestBed.inject(DaemonsService);
  });

  describe("load", () => {
    it("populates daemons from the API", async () => {
      const daemons = [makeDaemon()];
      rotationSdk.listConnectors.mockResolvedValue(daemons);

      await service.load(orgId);

      const rows = await firstValue(service.rows$);
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(connectorId("daemon-1"));
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
      rotationSdk.listConnectors.mockResolvedValue([makeDaemon()]);

      await service.load(orgId);

      expect(await firstValue(service.loadError$)).toBeNull();
    });

    it("reports a target-systems failure even when the daemon list loads", async () => {
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
        makeDaemon({ assignedTargetSystemIds: [sysId("ts-1")] }),
      ]);

      await service.load(orgId);
      const rows = await firstValue(service.rows$);
      expect(rows[0].assignmentNames).toEqual(["Production DB"]);
    });

    it("falls back to the raw ID when a target system is not found", async () => {
      rotationSdk.listConnectors.mockResolvedValue([
        makeDaemon({ assignedTargetSystemIds: [sysId("unknown-id")] }),
      ]);

      await service.load(orgId);
      const rows = await firstValue(service.rows$);
      expect(rows[0].assignmentNames).toEqual([String(sysId("unknown-id"))]);
    });

    it("sets enabled and canAssign true for enabled daemons", async () => {
      rotationSdk.listConnectors.mockResolvedValue([makeDaemon({ status: DaemonStatus.Enabled })]);
      await service.load(orgId);
      const rows = await firstValue(service.rows$);
      expect(rows[0].enabled).toBe(true);
      expect(rows[0].canAssign).toBe(true);
    });

    it("sets enabled and canAssign false for disabled daemons", async () => {
      rotationSdk.listConnectors.mockResolvedValue([makeDaemon({ status: DaemonStatus.Disabled })]);
      await service.load(orgId);
      const rows = await firstValue(service.rows$);
      expect(rows[0].enabled).toBe(false);
      expect(rows[0].canAssign).toBe(false);
    });

    it("uses pamDaemonStatusEnabled key for enabled daemons", async () => {
      rotationSdk.listConnectors.mockResolvedValue([makeDaemon({ status: DaemonStatus.Enabled })]);
      await service.load(orgId);
      const rows = await firstValue(service.rows$);
      expect(rows[0].statusLabelKey).toBe("pamDaemonStatusEnabled");
    });

    it("uses pamDaemonStatusDisabled key for disabled daemons", async () => {
      rotationSdk.listConnectors.mockResolvedValue([makeDaemon({ status: DaemonStatus.Disabled })]);
      await service.load(orgId);
      const rows = await firstValue(service.rows$);
      expect(rows[0].statusLabelKey).toBe("pamDaemonStatusDisabled");
    });
  });

  describe("setEnabled", () => {
    it("disables via the API and patches status", async () => {
      const daemon = makeDaemon({ status: DaemonStatus.Enabled });
      rotationSdk.listConnectors.mockResolvedValue([daemon]);
      await service.load(orgId);

      await service.setEnabled(daemon, false);

      const rows = await firstValue(service.rows$);
      expect(rows[0].enabled).toBe(false);
      expect(rotationSdk.disableConnector).toHaveBeenCalledWith(orgId, daemon.id);
    });

    it("enables via the API and patches status", async () => {
      const daemon = makeDaemon({ status: DaemonStatus.Disabled });
      rotationSdk.listConnectors.mockResolvedValue([daemon]);
      await service.load(orgId);

      await service.setEnabled(daemon, true);

      const rows = await firstValue(service.rows$);
      expect(rows[0].enabled).toBe(true);
      expect(rotationSdk.enableConnector).toHaveBeenCalledWith(orgId, daemon.id);
    });

    it("rolls back on API failure", async () => {
      const daemon = makeDaemon({ status: DaemonStatus.Enabled });
      rotationSdk.listConnectors.mockResolvedValue([daemon]);
      rotationSdk.disableConnector.mockRejectedValue(new Error("fail"));
      await service.load(orgId);

      await expect(service.setEnabled(daemon, false)).rejects.toThrow();

      const rows = await firstValue(service.rows$);
      expect(rows[0].enabled).toBe(true);
    });
  });

  describe("delete", () => {
    it("calls API and removes the daemon from local state", async () => {
      const daemon = makeDaemon({ id: connectorId("daemon-1") });
      rotationSdk.listConnectors.mockResolvedValue([
        daemon,
        makeDaemon({ id: connectorId("daemon-2") }),
      ]);
      await service.load(orgId);

      await service.delete(daemon);

      const rows = await firstValue(service.rows$);
      expect(rows.map((r) => r.id)).toEqual([connectorId("daemon-2")]);
      expect(rotationSdk.deleteConnector).toHaveBeenCalledWith(orgId, daemon.id);
    });
  });

  describe("forgetTargetSystem", () => {
    it("removes the target from every daemon that had it assigned", async () => {
      rotationSdk.listConnectors.mockResolvedValue([
        makeDaemon({
          id: connectorId("daemon-1"),
          assignedTargetSystemIds: [sysId("ts-1"), sysId("ts-2")],
        }),
        makeDaemon({ id: connectorId("daemon-2"), assignedTargetSystemIds: [sysId("ts-1")] }),
      ]);
      await service.load(orgId);

      service.forgetTargetSystem(sysId("ts-1"));

      const rows = await firstValue(service.rows$);
      expect(rows[0].daemon.assignedTargetSystemIds).toEqual([sysId("ts-2")]);
      expect(rows[1].daemon.assignedTargetSystemIds).toEqual([]);
    });

    it("leaves daemons without that assignment untouched", async () => {
      const untouched = makeDaemon({
        id: connectorId("daemon-1"),
        assignedTargetSystemIds: [sysId("ts-2")],
      });
      rotationSdk.listConnectors.mockResolvedValue([untouched]);
      await service.load(orgId);

      service.forgetTargetSystem(sysId("ts-1"));

      const rows = await firstValue(service.rows$);
      expect(rows[0].daemon).toBe(untouched);
    });

    it("does not reach the server — the delete already took the assignments", async () => {
      rotationSdk.listConnectors.mockResolvedValue([
        makeDaemon({ assignedTargetSystemIds: [sysId("ts-1")] }),
      ]);
      await service.load(orgId);

      service.forgetTargetSystem(sysId("ts-1"));

      expect(rotationSdk.unassignTarget).not.toHaveBeenCalled();
    });
  });

  describe("assign", () => {
    it("optimistically adds the target system ID", async () => {
      const daemon = makeDaemon({ assignedTargetSystemIds: [] });
      rotationSdk.listConnectors.mockResolvedValue([daemon]);
      await service.load(orgId);

      await service.assign(daemon, sysId("ts-99"));

      const rows = await firstValue(service.rows$);
      expect(rows[0].daemon.assignedTargetSystemIds).toContain(sysId("ts-99"));
    });

    it("rolls back on API failure", async () => {
      const daemon = makeDaemon({ assignedTargetSystemIds: [] });
      rotationSdk.listConnectors.mockResolvedValue([daemon]);
      rotationSdk.assignTarget.mockRejectedValue(new Error("fail"));
      await service.load(orgId);

      await expect(service.assign(daemon, sysId("ts-99"))).rejects.toThrow();

      const rows = await firstValue(service.rows$);
      expect(rows[0].daemon.assignedTargetSystemIds).not.toContain(sysId("ts-99"));
    });
  });

  describe("unassign", () => {
    it("optimistically removes the target system ID", async () => {
      const daemon = makeDaemon({ assignedTargetSystemIds: [sysId("ts-1")] });
      rotationSdk.listConnectors.mockResolvedValue([daemon]);
      await service.load(orgId);

      await service.unassign(daemon, sysId("ts-1"));

      const rows = await firstValue(service.rows$);
      expect(rows[0].daemon.assignedTargetSystemIds).not.toContain(sysId("ts-1"));
    });

    it("rolls back on API failure", async () => {
      const daemon = makeDaemon({ assignedTargetSystemIds: [sysId("ts-1")] });
      rotationSdk.listConnectors.mockResolvedValue([daemon]);
      rotationSdk.unassignTarget.mockRejectedValue(new Error("fail"));
      await service.load(orgId);

      await expect(service.unassign(daemon, sysId("ts-1"))).rejects.toThrow();

      const rows = await firstValue(service.rows$);
      expect(rows[0].daemon.assignedTargetSystemIds).toContain(sysId("ts-1"));
    });
  });

  describe("registerCompleted", () => {
    it("re-loads daemons from the API", async () => {
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
