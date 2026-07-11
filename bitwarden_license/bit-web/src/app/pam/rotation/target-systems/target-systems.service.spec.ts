import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import {
  PamApiService,
  TargetSystemResponse,
  TargetSystemKind,
  TargetSystemMethod,
  TargetSystemStatus,
} from "@bitwarden/bit-pam";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { OrganizationId } from "@bitwarden/common/types/guid";

import { TargetSystemsService } from "./target-systems.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSystem(overrides: Partial<TargetSystemResponse> = {}): TargetSystemResponse {
  return {
    id: "sys-1",
    name: "Prod Entra",
    method: TargetSystemMethod.Automatic,
    kind: TargetSystemKind.Entra,
    status: TargetSystemStatus.Active,
    passwordPolicy: null,
    supportsSessionTermination: true,
    ...overrides,
  } as TargetSystemResponse;
}

function makeListResponse(data: TargetSystemResponse[]): ListResponse<TargetSystemResponse> {
  return { data, continuationToken: null } as unknown as ListResponse<TargetSystemResponse>;
}

const ORG_ID = "org-123" as OrganizationId;

describe("TargetSystemsService", () => {
  let pamApi: ReturnType<typeof mock<PamApiService>>;
  let service: TargetSystemsService;

  beforeEach(() => {
    pamApi = mock<PamApiService>();
    TestBed.configureTestingModule({
      providers: [TargetSystemsService, { provide: PamApiService, useValue: pamApi }],
    });
    service = TestBed.inject(TargetSystemsService);
  });

  describe("load", () => {
    it("sets loading true initially, then false after", async () => {
      const loadingStates: boolean[] = [];
      service.loading$.subscribe((v) => loadingStates.push(v));

      pamApi.listTargetSystems.mockResolvedValue(makeListResponse([makeSystem()]));
      await service.load(ORG_ID);

      // initial true (from BehaviorSubject(true)), then false after resolve
      expect(loadingStates).toContain(false);
      expect(loadingStates[0]).toBe(true);
    });

    it("populates systems$ with the API response", async () => {
      const sys = makeSystem({ id: "sys-abc" });
      pamApi.listTargetSystems.mockResolvedValue(makeListResponse([sys]));
      await service.load(ORG_ID);

      const systems = await firstValueFrom(service.systems$);
      expect(systems).toHaveLength(1);
      expect(systems[0].id).toBe("sys-abc");
    });

    it("sets loading false even when the API throws", async () => {
      pamApi.listTargetSystems.mockRejectedValue(new Error("network fail"));
      await expect(service.load(ORG_ID)).rejects.toThrow("network fail");

      const loading = await firstValueFrom(service.loading$);
      expect(loading).toBe(false);
    });
  });

  describe("systemById$", () => {
    it("provides a Map keyed by id", async () => {
      const a = makeSystem({ id: "a" });
      const b = makeSystem({ id: "b" });
      pamApi.listTargetSystems.mockResolvedValue(makeListResponse([a, b]));
      await service.load(ORG_ID);

      const map = await firstValueFrom(service.systemById$);
      expect(map.get("a")).toBeDefined();
      expect(map.get("b")).toBeDefined();
      expect(map.get("a")!.id).toBe("a");
    });
  });

  describe("activeAutomaticSystems$", () => {
    it("returns only Active + Automatic systems", async () => {
      const active = makeSystem({
        id: "active",
        status: TargetSystemStatus.Active,
        method: TargetSystemMethod.Automatic,
      });
      const disabled = makeSystem({
        id: "disabled",
        status: TargetSystemStatus.Disabled,
        method: TargetSystemMethod.Automatic,
      });
      const manual = makeSystem({
        id: "manual",
        status: TargetSystemStatus.Active,
        method: TargetSystemMethod.Manual,
        kind: null,
      });
      pamApi.listTargetSystems.mockResolvedValue(makeListResponse([active, disabled, manual]));
      await service.load(ORG_ID);

      const result = await firstValueFrom(service.activeAutomaticSystems$);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("active");
    });
  });

  describe("setEnabled", () => {
    beforeEach(async () => {
      pamApi.listTargetSystems.mockResolvedValue(
        makeListResponse([makeSystem({ id: "sys-1", status: TargetSystemStatus.Active })]),
      );
      await service.load(ORG_ID);
    });

    it("calls enableTargetSystem when enabling", async () => {
      pamApi.enableTargetSystem.mockResolvedValue(undefined);
      const sys = makeSystem({ id: "sys-1", status: TargetSystemStatus.Disabled });
      await service.setEnabled(sys, true);
      expect(pamApi.enableTargetSystem).toHaveBeenCalledWith(ORG_ID, "sys-1");
    });

    it("calls disableTargetSystem when disabling", async () => {
      pamApi.disableTargetSystem.mockResolvedValue(undefined);
      const sys = makeSystem({ id: "sys-1", status: TargetSystemStatus.Active });
      await service.setEnabled(sys, false);
      expect(pamApi.disableTargetSystem).toHaveBeenCalledWith(ORG_ID, "sys-1");
    });

    it("patches local status to Active when enabling", async () => {
      pamApi.enableTargetSystem.mockResolvedValue(undefined);
      const sys = makeSystem({ id: "sys-1", status: TargetSystemStatus.Disabled });
      await service.setEnabled(sys, true);

      const systems = await firstValueFrom(service.systems$);
      expect(systems[0].status).toBe(TargetSystemStatus.Active);
    });

    it("patches local status to Disabled when disabling", async () => {
      pamApi.disableTargetSystem.mockResolvedValue(undefined);
      const sys = makeSystem({ id: "sys-1", status: TargetSystemStatus.Active });
      await service.setEnabled(sys, false);

      const systems = await firstValueFrom(service.systems$);
      expect(systems[0].status).toBe(TargetSystemStatus.Disabled);
    });
  });

  describe("delete", () => {
    beforeEach(async () => {
      pamApi.listTargetSystems.mockResolvedValue(
        makeListResponse([makeSystem({ id: "sys-1" }), makeSystem({ id: "sys-2" })]),
      );
      await service.load(ORG_ID);
    });

    it("calls deleteTargetSystem and removes it from local state", async () => {
      pamApi.deleteTargetSystem.mockResolvedValue(undefined);
      await service.delete(makeSystem({ id: "sys-1" }));

      expect(pamApi.deleteTargetSystem).toHaveBeenCalledWith(ORG_ID, "sys-1");
      const systems = await firstValueFrom(service.systems$);
      expect(systems.map((s) => s.id)).toEqual(["sys-2"]);
    });

    it("leaves local state unchanged when the API rejects", async () => {
      pamApi.deleteTargetSystem.mockRejectedValue(new Error("in use"));
      await expect(service.delete(makeSystem({ id: "sys-1" }))).rejects.toThrow("in use");

      const systems = await firstValueFrom(service.systems$);
      expect(systems.map((s) => s.id)).toEqual(["sys-1", "sys-2"]);
    });
  });
});
