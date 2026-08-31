import { TestBed } from "@angular/core/testing";
import { BehaviorSubject } from "rxjs";

import { OrganizationId } from "@bitwarden/common/types/guid";

import type { AccessConnectorView, TargetSystemId, TargetSystemView } from "../rotation";
import { DaemonStatus } from "../rotation";
import { RotationSdkService } from "../rotation-sdk.service";
import { TargetSystemsService } from "../target-systems/target-systems.service";

import { DaemonsService } from "./daemons.service";
import { connectorId, sysId } from "../testing/rotation-builders";

const orgId = "org-1" as OrganizationId;

function makeDaemon(overrides: Partial<AccessConnectorView> = {}): AccessConnectorView {
  return {
    id: connectorId("daemon-1"),
    name: "My Daemon",
    status: DaemonStatus.Enabled,
    isConnected: true,
    assignedTargetSystemIds: [],
    ...overrides,
  } as unknown as AccessConnectorView;
}

function makeTargetSystem(id: TargetSystemId, name: string): TargetSystemView {
  return { id, name } as unknown as TargetSystemView;
}

describe("DaemonsService", () => {
  let service: DaemonsService;
  let rotationSdk: jest.Mocked<RotationSdkService>;
  let targetSystemsService: jest.Mocked<TargetSystemsService>;
  let systemById$: BehaviorSubject<Map<TargetSystemId, TargetSystemView>>;

  beforeEach(() => {
    systemById$ = new BehaviorSubject<Map<TargetSystemId, TargetSystemView>>(new Map());

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
  });

  describe("rows$ projection", () => {
    it("resolves assignment IDs to target system names", async () => {
      const system = makeTargetSystem(sysId("ts-1"), "Production DB");
      systemById$.next(new Map([[sysId("ts-1"), system]]));
      rotationSdk.listConnectors.mockResolvedValue({
        data: [makeDaemon({ assignedTargetSystemIds: [sysId("ts-1")] })],
      } as any);

      await service.load(orgId);
      const rows = await firstValue(service.rows$);
      expect(rows[0].assignmentNames).toEqual(["Production DB"]);
    });

    it("falls back to the raw ID when a target system is not found", async () => {
      rotationSdk.listConnectors.mockResolvedValue({
        data: [makeDaemon({ assignedTargetSystemIds: [sysId("unknown-id")] })],
      } as any);

      await service.load(orgId);
      const rows = await firstValue(service.rows$);
      expect(rows[0].assignmentNames).toEqual(["unknown-id"]);
    });

    it("sets enabled and canAssign true for enabled daemons", async () => {
      rotationSdk.listConnectors.mockResolvedValue({
        data: [makeDaemon({ status: DaemonStatus.Enabled })],
      } as any);
      await service.load(orgId);
      const rows = await firstValue(service.rows$);
      expect(rows[0].enabled).toBe(true);
      expect(rows[0].canAssign).toBe(true);
    });

    it("sets enabled and canAssign false for disabled daemons", async () => {
      rotationSdk.listConnectors.mockResolvedValue({
        data: [makeDaemon({ status: DaemonStatus.Disabled })],
      } as any);
      await service.load(orgId);
      const rows = await firstValue(service.rows$);
      expect(rows[0].enabled).toBe(false);
      expect(rows[0].canAssign).toBe(false);
    });

    it("uses pamDaemonStatusEnabled key for enabled daemons", async () => {
      rotationSdk.listConnectors.mockResolvedValue({
        data: [makeDaemon({ status: DaemonStatus.Enabled })],
      } as any);
      await service.load(orgId);
      const rows = await firstValue(service.rows$);
      expect(rows[0].statusLabelKey).toBe("pamDaemonStatusEnabled");
    });

    it("uses pamDaemonStatusDisabled key for disabled daemons", async () => {
      rotationSdk.listConnectors.mockResolvedValue({
        data: [makeDaemon({ status: DaemonStatus.Disabled })],
      } as any);
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
      rotationSdk.listConnectors.mockResolvedValue({
        data: [daemon, makeDaemon({ id: connectorId("daemon-2") })],
      } as any);
      await service.load(orgId);

      await service.delete(daemon);

      const rows = await firstValue(service.rows$);
      expect(rows.map((r) => r.id)).toEqual([connectorId("daemon-2")]);
      expect(rotationSdk.deleteConnector).toHaveBeenCalledWith(orgId, daemon.id);
    });
  });

  describe("assign", () => {
    it("optimistically adds the target system ID", async () => {
      const daemon = makeDaemon({ assignedTargetSystemIds: [] });
      rotationSdk.listConnectors.mockResolvedValue([daemon]);
      await service.load(orgId);

      await service.assign(daemon, sysId("ts-99"));

      const rows = await firstValue(service.rows$);
      expect(rows[0].daemon.assignedTargetSystemIds).toContain("ts-99");
    });

    it("rolls back on API failure", async () => {
      const daemon = makeDaemon({ assignedTargetSystemIds: [] });
      rotationSdk.listConnectors.mockResolvedValue([daemon]);
      rotationSdk.assignTarget.mockRejectedValue(new Error("fail"));
      await service.load(orgId);

      await expect(service.assign(daemon, sysId("ts-99"))).rejects.toThrow();

      const rows = await firstValue(service.rows$);
      expect(rows[0].daemon.assignedTargetSystemIds).not.toContain("ts-99");
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
