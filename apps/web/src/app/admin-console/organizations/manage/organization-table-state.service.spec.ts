import { TestBed } from "@angular/core/testing";
import { firstValueFrom } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { newGuid } from "@bitwarden/guid";
import { StateProvider } from "@bitwarden/state";
import { FakeStateProvider } from "@bitwarden/state-test-utils";

import { OrganizationTableStateService } from "./organization-table-state.service";

describe("OrganizationTableStateService", () => {
  const userId = newGuid() as UserId;
  const orgId = newGuid() as OrganizationId;
  const otherOrgId = newGuid() as OrganizationId;

  let accountService: FakeAccountService;
  let stateProvider: FakeStateProvider;

  function setup(providers: unknown[] = []) {
    TestBed.configureTestingModule({ providers: providers as never[] });
    return TestBed.inject(OrganizationTableStateService);
  }

  beforeEach(() => {
    accountService = mockAccountServiceWith(userId);
    stateProvider = new FakeStateProvider(accountService);
  });

  describe("with a StateProvider", () => {
    let service: OrganizationTableStateService;

    beforeEach(() => {
      service = setup([
        { provide: StateProvider, useValue: stateProvider },
        { provide: LogService, useValue: { error: jest.fn() } },
      ]);
    });

    it("starts with an empty view", async () => {
      expect(await firstValueFrom(service.state$(userId, orgId, "groups"))).toEqual({});
    });

    it("round-trips a saved view", async () => {
      await service.save(userId, orgId, "groups", {
        sharedFolders: ["col-eng"],
        search: "engineering",
        sortColumn: "details",
        sortDirection: "desc",
      });

      expect(await firstValueFrom(service.state$(userId, orgId, "groups"))).toEqual({
        sharedFolders: ["col-eng"],
        search: "engineering",
        sortColumn: "details",
        sortDirection: "desc",
      });
    });

    it("overwrites the previously saved view for the same table rather than merging into it", async () => {
      await service.save(userId, orgId, "groups", {
        sharedFolders: ["col-eng"],
        search: "engineering",
      });
      await service.save(userId, orgId, "groups", { sortColumn: "details", sortDirection: "desc" });

      expect(await firstValueFrom(service.state$(userId, orgId, "groups"))).toEqual({
        sortColumn: "details",
        sortDirection: "desc",
      });
    });

    it("keeps each organization's view separate", async () => {
      await service.save(userId, orgId, "groups", { sharedFolders: ["col-eng"] });
      await service.save(userId, otherOrgId, "groups", { sharedFolders: ["col-design"] });

      expect(await firstValueFrom(service.state$(userId, orgId, "groups"))).toEqual({
        sharedFolders: ["col-eng"],
      });
      expect(await firstValueFrom(service.state$(userId, otherOrgId, "groups"))).toEqual({
        sharedFolders: ["col-design"],
      });
    });

    it("keeps each table's view separate within the same organization", async () => {
      await service.save(userId, orgId, "groups", { search: "engineering" });
      await service.save(userId, orgId, "members", { search: "design" });

      expect(await firstValueFrom(service.state$(userId, orgId, "groups"))).toEqual({
        search: "engineering",
      });
      expect(await firstValueFrom(service.state$(userId, orgId, "members"))).toEqual({
        search: "design",
      });
    });

    it("stores an empty filter, so clearing it persists too", async () => {
      await service.save(userId, orgId, "groups", { sharedFolders: ["col-eng"] });
      await service.save(userId, orgId, "groups", { sharedFolders: [] });

      expect(await firstValueFrom(service.state$(userId, orgId, "groups"))).toEqual({
        sharedFolders: [],
      });
    });
  });

  describe("without a StateProvider", () => {
    it("reports an empty view and ignores writes", async () => {
      const service = setup();

      await service.save(userId, orgId, "groups", { sharedFolders: ["col-eng"] });

      expect(await firstValueFrom(service.state$(userId, orgId, "groups"))).toEqual({});
    });
  });
});
