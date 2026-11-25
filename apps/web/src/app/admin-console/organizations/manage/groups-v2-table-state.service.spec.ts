import { TestBed } from "@angular/core/testing";
import { firstValueFrom } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { newGuid } from "@bitwarden/guid";
import { StateProvider } from "@bitwarden/state";
import { FakeStateProvider } from "@bitwarden/state-test-utils";

import { GroupsV2TableStateService } from "./groups-v2-table-state.service";

describe("GroupsV2TableStateService", () => {
  const userId = newGuid() as UserId;
  const orgId = newGuid() as OrganizationId;
  const otherOrgId = newGuid() as OrganizationId;

  let accountService: FakeAccountService;
  let stateProvider: FakeStateProvider;

  function setup(providers: unknown[] = []) {
    TestBed.configureTestingModule({ providers: providers as never[] });
    return TestBed.inject(GroupsV2TableStateService);
  }

  beforeEach(() => {
    accountService = mockAccountServiceWith(userId);
    stateProvider = new FakeStateProvider(accountService);
  });

  describe("with a StateProvider", () => {
    let service: GroupsV2TableStateService;

    beforeEach(() => {
      service = setup([
        { provide: StateProvider, useValue: stateProvider },
        { provide: LogService, useValue: { error: jest.fn() } },
      ]);
    });

    it("starts with an empty view", async () => {
      expect(await firstValueFrom(service.state$(orgId))).toEqual({});
    });

    it("round-trips the shared folder filter", async () => {
      await service.update(orgId, { sharedFolders: ["col-eng"] });

      expect(await firstValueFrom(service.state$(orgId))).toEqual({ sharedFolders: ["col-eng"] });
    });

    it("round-trips the sort column and direction", async () => {
      await service.update(orgId, { sortColumn: "details", sortDirection: "desc" });

      expect(await firstValueFrom(service.state$(orgId))).toEqual({
        sortColumn: "details",
        sortDirection: "desc",
      });
    });

    it("round-trips the search term", async () => {
      await service.update(orgId, { search: "engineering" });

      expect(await firstValueFrom(service.state$(orgId))).toEqual({ search: "engineering" });
    });

    it("merges a patch rather than replacing the stored view", async () => {
      await service.update(orgId, { sharedFolders: ["col-eng"] });
      await service.update(orgId, { sortColumn: "details", sortDirection: "desc" });
      await service.update(orgId, { search: "engineering" });

      expect(await firstValueFrom(service.state$(orgId))).toEqual({
        sharedFolders: ["col-eng"],
        sortColumn: "details",
        sortDirection: "desc",
        search: "engineering",
      });
    });

    it("keeps each organization's view separate", async () => {
      await service.update(orgId, { sharedFolders: ["col-eng"] });
      await service.update(otherOrgId, { sharedFolders: ["col-design"] });

      expect(await firstValueFrom(service.state$(orgId))).toEqual({ sharedFolders: ["col-eng"] });
      expect(await firstValueFrom(service.state$(otherOrgId))).toEqual({
        sharedFolders: ["col-design"],
      });
    });

    it("stores an empty filter, so clearing it persists too", async () => {
      await service.update(orgId, { sharedFolders: ["col-eng"] });
      await service.update(orgId, { sharedFolders: [] });

      expect(await firstValueFrom(service.state$(orgId))).toEqual({ sharedFolders: [] });
    });
  });

  describe("without a StateProvider", () => {
    it("reports an empty view and ignores writes", async () => {
      const service = setup();

      await service.update(orgId, { sharedFolders: ["col-eng"] });

      expect(await firstValueFrom(service.state$(orgId))).toEqual({});
    });
  });
});
