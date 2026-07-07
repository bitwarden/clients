import { TestBed } from "@angular/core/testing";
import { BehaviorSubject } from "rxjs";

import {
  DaemonStatus,
  PamApiService,
  RotationDaemonResponse,
  TargetSystemResponse,
} from "@bitwarden/bit-pam";
import { OrganizationId } from "@bitwarden/common/types/guid";

import { TargetSystemsService } from "../target-systems/target-systems.service";

import { DaemonsService } from "./daemons.service";

const orgId = "org-1" as OrganizationId;

function makeDaemon(overrides: Partial<RotationDaemonResponse> = {}): RotationDaemonResponse {
  return {
    id: "daemon-1",
    name: "My Daemon",
    status: DaemonStatus.Enrolled,
    isConnected: true,
    assignments: [],
    ...overrides,
  } as unknown as RotationDaemonResponse;
}

function makeTargetSystem(id: string, name: string): TargetSystemResponse {
  return { id, name } as unknown as TargetSystemResponse;
}

describe("DaemonsService", () => {
  let service: DaemonsService;
  let pamApi: jest.Mocked<PamApiService>;
  let targetSystemsService: jest.Mocked<TargetSystemsService>;
  let systemById$: BehaviorSubject<Map<string, TargetSystemResponse>>;

  beforeEach(() => {
    systemById$ = new BehaviorSubject<Map<string, TargetSystemResponse>>(new Map());

    pamApi = {
      listRotationDaemons: jest.fn().mockResolvedValue({ data: [] }),
      revokeRotationDaemon: jest.fn().mockResolvedValue(undefined),
      assignRotationDaemon: jest.fn().mockResolvedValue(undefined),
      unassignRotationDaemon: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<PamApiService>;

    targetSystemsService = {
      systemById$: systemById$.asObservable(),
    } as unknown as jest.Mocked<TargetSystemsService>;

    TestBed.configureTestingModule({
      providers: [
        DaemonsService,
        { provide: PamApiService, useValue: pamApi },
        { provide: TargetSystemsService, useValue: targetSystemsService },
      ],
    });

    service = TestBed.inject(DaemonsService);
  });

  describe("load", () => {
    it("populates daemons from the API", async () => {
      const daemons = [makeDaemon()];
      pamApi.listRotationDaemons.mockResolvedValue({ data: daemons } as any);

      await service.load(orgId);

      const rows = await firstValue(service.rows$);
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe("daemon-1");
    });

    it("sets loading to false after load", async () => {
      await service.load(orgId);
      const loading = await firstValue(service.loading$);
      expect(loading).toBe(false);
    });
  });

  describe("rows$ projection", () => {
    it("resolves assignment IDs to target system names", async () => {
      const system = makeTargetSystem("ts-1", "Production DB");
      systemById$.next(new Map([["ts-1", system]]));
      pamApi.listRotationDaemons.mockResolvedValue({
        data: [makeDaemon({ assignments: ["ts-1"] })],
      } as any);

      await service.load(orgId);
      const rows = await firstValue(service.rows$);
      expect(rows[0].assignmentNames).toEqual(["Production DB"]);
    });

    it("falls back to the raw ID when a target system is not found", async () => {
      pamApi.listRotationDaemons.mockResolvedValue({
        data: [makeDaemon({ assignments: ["unknown-id"] })],
      } as any);

      await service.load(orgId);
      const rows = await firstValue(service.rows$);
      expect(rows[0].assignmentNames).toEqual(["unknown-id"]);
    });

    it("sets canRevoke and canAssign true for Enrolled daemons", async () => {
      pamApi.listRotationDaemons.mockResolvedValue({
        data: [makeDaemon({ status: DaemonStatus.Enrolled })],
      } as any);
      await service.load(orgId);
      const rows = await firstValue(service.rows$);
      expect(rows[0].canRevoke).toBe(true);
      expect(rows[0].canAssign).toBe(true);
    });

    it("sets canRevoke and canAssign false for Revoked daemons", async () => {
      pamApi.listRotationDaemons.mockResolvedValue({
        data: [makeDaemon({ status: DaemonStatus.Revoked })],
      } as any);
      await service.load(orgId);
      const rows = await firstValue(service.rows$);
      expect(rows[0].canRevoke).toBe(false);
      expect(rows[0].canAssign).toBe(false);
    });

    it("uses pamDaemonStatusEnrolled key for Enrolled daemons", async () => {
      pamApi.listRotationDaemons.mockResolvedValue({
        data: [makeDaemon({ status: DaemonStatus.Enrolled })],
      } as any);
      await service.load(orgId);
      const rows = await firstValue(service.rows$);
      expect(rows[0].statusLabelKey).toBe("pamDaemonStatusEnrolled");
    });

    it("uses pamDaemonStatusRevoked key for Revoked daemons", async () => {
      pamApi.listRotationDaemons.mockResolvedValue({
        data: [makeDaemon({ status: DaemonStatus.Revoked })],
      } as any);
      await service.load(orgId);
      const rows = await firstValue(service.rows$);
      expect(rows[0].statusLabelKey).toBe("pamDaemonStatusRevoked");
    });
  });

  describe("revoke", () => {
    it("calls API and patches status to Revoked", async () => {
      const daemon = makeDaemon({ status: DaemonStatus.Enrolled });
      pamApi.listRotationDaemons.mockResolvedValue({ data: [daemon] } as any);
      await service.load(orgId);

      await service.revoke(daemon);

      const rows = await firstValue(service.rows$);
      expect(rows[0].statusLabelKey).toBe("pamDaemonStatusRevoked");
      expect(pamApi.revokeRotationDaemon).toHaveBeenCalledWith(orgId, daemon.id);
    });
  });

  describe("assign", () => {
    it("optimistically adds the target system ID", async () => {
      const daemon = makeDaemon({ assignments: [] });
      pamApi.listRotationDaemons.mockResolvedValue({ data: [daemon] } as any);
      await service.load(orgId);

      await service.assign(daemon, "ts-99");

      const rows = await firstValue(service.rows$);
      expect(rows[0].daemon.assignments).toContain("ts-99");
    });

    it("rolls back on API failure", async () => {
      const daemon = makeDaemon({ assignments: [] });
      pamApi.listRotationDaemons.mockResolvedValue({ data: [daemon] } as any);
      pamApi.assignRotationDaemon.mockRejectedValue(new Error("fail"));
      await service.load(orgId);

      await expect(service.assign(daemon, "ts-99")).rejects.toThrow();

      const rows = await firstValue(service.rows$);
      expect(rows[0].daemon.assignments).not.toContain("ts-99");
    });
  });

  describe("unassign", () => {
    it("optimistically removes the target system ID", async () => {
      const daemon = makeDaemon({ assignments: ["ts-1"] });
      pamApi.listRotationDaemons.mockResolvedValue({ data: [daemon] } as any);
      await service.load(orgId);

      await service.unassign(daemon, "ts-1");

      const rows = await firstValue(service.rows$);
      expect(rows[0].daemon.assignments).not.toContain("ts-1");
    });

    it("rolls back on API failure", async () => {
      const daemon = makeDaemon({ assignments: ["ts-1"] });
      pamApi.listRotationDaemons.mockResolvedValue({ data: [daemon] } as any);
      pamApi.unassignRotationDaemon.mockRejectedValue(new Error("fail"));
      await service.load(orgId);

      await expect(service.unassign(daemon, "ts-1")).rejects.toThrow();

      const rows = await firstValue(service.rows$);
      expect(rows[0].daemon.assignments).toContain("ts-1");
    });
  });

  describe("registerCompleted", () => {
    it("re-loads daemons from the API", async () => {
      await service.load(orgId);
      pamApi.listRotationDaemons.mockClear();
      pamApi.listRotationDaemons.mockResolvedValue({ data: [] } as any);

      await service.registerCompleted(orgId);

      expect(pamApi.listRotationDaemons).toHaveBeenCalledTimes(1);
    });
  });
});

// Helper to get the current value of an observable synchronously.
function firstValue<T>(obs: import("rxjs").Observable<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    obs.subscribe({ next: resolve, error: reject }).unsubscribe();
  });
}
