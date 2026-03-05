import { TestBed } from "@angular/core/testing";
import { of } from "rxjs";

import {
  CollectionService,
  OrganizationUserApiService,
  OrganizationUserUserDetailsResponse,
} from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";

import { GroupApiService } from "../../../core";

import { OrganizationMembersService } from "./organization-members.service";

describe("OrganizationMembersService", () => {
  let service: OrganizationMembersService;
  let organizationUserApiService: jest.Mocked<OrganizationUserApiService>;
  let groupService: jest.Mocked<GroupApiService>;
  let apiService: jest.Mocked<ApiService>;
  let keyService: jest.Mocked<KeyService>;
  let accountService: jest.Mocked<AccountService>;
  let collectionService: jest.Mocked<CollectionService>;

  const mockOrganizationId = "org-123" as OrganizationId;

  const createMockOrganization = (overrides: Partial<Organization> = {}): Organization => {
    const org = new Organization();
    org.id = mockOrganizationId;
    org.useGroups = false;

    return Object.assign(org, overrides);
  };

  const createMockUserResponse = (
    overrides: Partial<OrganizationUserUserDetailsResponse> = {},
  ): OrganizationUserUserDetailsResponse => {
    return {
      id: "user-1",
      userId: "user-id-1",
      email: "test@example.com",
      name: "Test User",
      collections: [],
      groups: [],
      ...overrides,
    } as OrganizationUserUserDetailsResponse;
  };

  const createMockGroup = (id: string, name: string) => ({
    id,
    name,
  });

  const createMockCollection = (id: string, name: string) => ({
    id,
    name,
    organizationId: mockOrganizationId,
  });

  beforeEach(() => {
    organizationUserApiService = {
      getAllUsers: jest.fn(),
    } as any;

    groupService = {
      getAll: jest.fn(),
    } as any;

    apiService = {
      getCollections: jest.fn(),
    } as any;

    keyService = {
      orgKeys$: jest.fn(),
    } as any;

    accountService = {
      activeAccount$: of({ id: "user-123" } as any),
    } as any;

    collectionService = {
      decryptMany$: jest.fn(),
    } as any;

    TestBed.configureTestingModule({
      providers: [
        OrganizationMembersService,
        { provide: OrganizationUserApiService, useValue: organizationUserApiService },
        { provide: GroupApiService, useValue: groupService },
        { provide: ApiService, useValue: apiService },
        { provide: KeyService, useValue: keyService },
        { provide: AccountService, useValue: accountService },
        { provide: CollectionService, useValue: collectionService },
      ],
    });

    service = TestBed.inject(OrganizationMembersService);
  });

  describe("loadUsers", () => {
    it("should load users with collections when organization does not use groups", async () => {
      const organization = createMockOrganization({ useGroups: false });
      const mockUser = createMockUserResponse({
        collections: [{ id: "col-1" } as any],
      });
      const mockUsersResponse: ListResponse<OrganizationUserUserDetailsResponse> = {
        data: [mockUser],
      } as any;
      const mockCollections = [createMockCollection("col-1", "Collection 1")];
      const mockOrgKey = { [mockOrganizationId]: {} as any };
      const mockDecryptedCollections = [{ id: "col-1", name: "Collection 1" }];

      organizationUserApiService.getAllUsers.mockResolvedValue(mockUsersResponse);
      apiService.getCollections.mockResolvedValue({
        data: mockCollections,
      } as any);
      keyService.orgKeys$.mockReturnValue(of(mockOrgKey));
      collectionService.decryptMany$.mockReturnValue(of(mockDecryptedCollections as any));

      const result = await service.loadUsers(organization);

      expect(organizationUserApiService.getAllUsers).toHaveBeenCalledWith(mockOrganizationId, {
        includeGroups: false,
        includeCollections: true,
      });
      expect(apiService.getCollections).toHaveBeenCalledWith(mockOrganizationId);
      expect(groupService.getAll).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].collectionNames).toEqual(["Collection 1"]);
      expect(result[0].groupNames).toEqual([]);
    });

    it("should load users with groups when organization uses groups", async () => {
      const organization = createMockOrganization({ useGroups: true });
      const mockUser = createMockUserResponse({
        groups: ["group-1", "group-2"],
      });
      const mockUsersResponse: ListResponse<OrganizationUserUserDetailsResponse> = {
        data: [mockUser],
      } as any;
      const mockGroups = [
        createMockGroup("group-1", "Group 1"),
        createMockGroup("group-2", "Group 2"),
      ];

      organizationUserApiService.getAllUsers.mockResolvedValue(mockUsersResponse);
      groupService.getAll.mockResolvedValue(mockGroups as any);

      const result = await service.loadUsers(organization);

      expect(organizationUserApiService.getAllUsers).toHaveBeenCalledWith(mockOrganizationId, {
        includeGroups: true,
        includeCollections: false,
      });
      expect(groupService.getAll).toHaveBeenCalledWith(mockOrganizationId);
      expect(apiService.getCollections).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].groupNames).toEqual(["Group 1", "Group 2"]);
      expect(result[0].collectionNames).toEqual([]);
    });

    it("should sort group names alphabetically", async () => {
      const organization = createMockOrganization({ useGroups: true });
      const mockUser = createMockUserResponse({
        groups: ["group-1", "group-2", "group-3"],
      });
      const mockUsersResponse: ListResponse<OrganizationUserUserDetailsResponse> = {
        data: [mockUser],
      } as any;
      const mockGroups = [
        createMockGroup("group-1", "Zebra Group"),
        createMockGroup("group-2", "Alpha Group"),
        createMockGroup("group-3", "Beta Group"),
      ];

      organizationUserApiService.getAllUsers.mockResolvedValue(mockUsersResponse);
      groupService.getAll.mockResolvedValue(mockGroups as any);

      const result = await service.loadUsers(organization);

      expect(result[0].groupNames).toEqual(["Alpha Group", "Beta Group", "Zebra Group"]);
    });

    it("should sort collection names alphabetically", async () => {
      const organization = createMockOrganization({ useGroups: false });
      const mockUser = createMockUserResponse({
        collections: [{ id: "col-1" } as any, { id: "col-2" } as any, { id: "col-3" } as any],
      });
      const mockUsersResponse: ListResponse<OrganizationUserUserDetailsResponse> = {
        data: [mockUser],
      } as any;
      const mockCollections = [
        createMockCollection("col-1", "Zebra Collection"),
        createMockCollection("col-2", "Alpha Collection"),
        createMockCollection("col-3", "Beta Collection"),
      ];
      const mockOrgKey = { [mockOrganizationId]: {} as any };
      const mockDecryptedCollections = [
        { id: "col-1", name: "Zebra Collection" },
        { id: "col-2", name: "Alpha Collection" },
        { id: "col-3", name: "Beta Collection" },
      ];

      organizationUserApiService.getAllUsers.mockResolvedValue(mockUsersResponse);
      apiService.getCollections.mockResolvedValue({
        data: mockCollections,
      } as any);
      keyService.orgKeys$.mockReturnValue(of(mockOrgKey));
      collectionService.decryptMany$.mockReturnValue(of(mockDecryptedCollections as any));

      const result = await service.loadUsers(organization);

      expect(result[0].collectionNames).toEqual([
        "Alpha Collection",
        "Beta Collection",
        "Zebra Collection",
      ]);
    });

    it("should filter out null or undefined group names", async () => {
      const organization = createMockOrganization({ useGroups: true });
      const mockUser = createMockUserResponse({
        groups: ["group-1", "group-2", "group-3"],
      });
      const mockUsersResponse: ListResponse<OrganizationUserUserDetailsResponse> = {
        data: [mockUser],
      } as any;
      const mockGroups = [
        createMockGroup("group-1", "Group 1"),
        // group-2 is missing - should be filtered out
        createMockGroup("group-3", "Group 3"),
      ];

      organizationUserApiService.getAllUsers.mockResolvedValue(mockUsersResponse);
      groupService.getAll.mockResolvedValue(mockGroups as any);

      const result = await service.loadUsers(organization);

      expect(result[0].groupNames).toEqual(["Group 1", "Group 3"]);
      expect(result[0].groupNames).not.toContain(undefined);
      expect(result[0].groupNames).not.toContain(null);
    });

    it("should filter out null or undefined collection names", async () => {
      const organization = createMockOrganization({ useGroups: false });
      const mockUser = createMockUserResponse({
        collections: [{ id: "col-1" } as any, { id: "col-2" } as any, { id: "col-3" } as any],
      });
      const mockUsersResponse: ListResponse<OrganizationUserUserDetailsResponse> = {
        data: [mockUser],
      } as any;
      const mockCollections = [
        createMockCollection("col-1", "Collection 1"),
        // col-2 is missing - should be filtered out
        createMockCollection("col-3", "Collection 3"),
      ];
      const mockOrgKey = { [mockOrganizationId]: {} as any };
      const mockDecryptedCollections = [
        { id: "col-1", name: "Collection 1" },
        // col-2 is missing - should be filtered out
        { id: "col-3", name: "Collection 3" },
      ];

      organizationUserApiService.getAllUsers.mockResolvedValue(mockUsersResponse);
      apiService.getCollections.mockResolvedValue({
        data: mockCollections,
      } as any);
      keyService.orgKeys$.mockReturnValue(of(mockOrgKey));
      collectionService.decryptMany$.mockReturnValue(of(mockDecryptedCollections as any));

      const result = await service.loadUsers(organization);

      expect(result[0].collectionNames).toEqual(["Collection 1", "Collection 3"]);
      expect(result[0].collectionNames).not.toContain(undefined);
      expect(result[0].collectionNames).not.toContain(null);
    });

    it("should handle multiple users", async () => {
      const organization = createMockOrganization({ useGroups: true });
      const mockUser1 = createMockUserResponse({
        id: "user-1",
        groups: ["group-1"],
      });
      const mockUser2 = createMockUserResponse({
        id: "user-2",
        groups: ["group-2"],
      });
      const mockUsersResponse: ListResponse<OrganizationUserUserDetailsResponse> = {
        data: [mockUser1, mockUser2],
      } as any;
      const mockGroups = [
        createMockGroup("group-1", "Group 1"),
        createMockGroup("group-2", "Group 2"),
      ];

      organizationUserApiService.getAllUsers.mockResolvedValue(mockUsersResponse);
      groupService.getAll.mockResolvedValue(mockGroups as any);

      const result = await service.loadUsers(organization);

      expect(result).toHaveLength(2);
      expect(result[0].groupNames).toEqual(["Group 1"]);
      expect(result[1].groupNames).toEqual(["Group 2"]);
    });

    it("should return empty array when usersResponse.data is null", async () => {
      const organization = createMockOrganization({ useGroups: false });
      const mockUsersResponse: ListResponse<OrganizationUserUserDetailsResponse> = {
        data: null as any,
      } as any;
      const mockOrgKey = { [mockOrganizationId]: {} as any };

      organizationUserApiService.getAllUsers.mockResolvedValue(mockUsersResponse);
      apiService.getCollections.mockResolvedValue({
        data: [],
      } as any);
      keyService.orgKeys$.mockReturnValue(of(mockOrgKey));
      collectionService.decryptMany$.mockReturnValue(of([]));

      const result = await service.loadUsers(organization);

      expect(result).toEqual([]);
    });

    it("should return empty array when usersResponse.data is undefined", async () => {
      const organization = createMockOrganization({ useGroups: false });
      const mockUsersResponse: ListResponse<OrganizationUserUserDetailsResponse> = {
        data: undefined as any,
      } as any;
      const mockOrgKey = { [mockOrganizationId]: {} as any };

      organizationUserApiService.getAllUsers.mockResolvedValue(mockUsersResponse);
      apiService.getCollections.mockResolvedValue({
        data: [],
      } as any);
      keyService.orgKeys$.mockReturnValue(of(mockOrgKey));
      collectionService.decryptMany$.mockReturnValue(of([]));

      const result = await service.loadUsers(organization);

      expect(result).toEqual([]);
    });

    it("should handle empty groups array", async () => {
      const organization = createMockOrganization({ useGroups: true });
      const mockUser = createMockUserResponse({
        groups: [],
      });
      const mockUsersResponse: ListResponse<OrganizationUserUserDetailsResponse> = {
        data: [mockUser],
      } as any;

      organizationUserApiService.getAllUsers.mockResolvedValue(mockUsersResponse);
      groupService.getAll.mockResolvedValue([]);

      const result = await service.loadUsers(organization);

      expect(result).toHaveLength(1);
      expect(result[0].groupNames).toEqual([]);
    });

    it("should handle empty collections array", async () => {
      const organization = createMockOrganization({ useGroups: false });
      const mockUser = createMockUserResponse({
        collections: [],
      });
      const mockUsersResponse: ListResponse<OrganizationUserUserDetailsResponse> = {
        data: [mockUser],
      } as any;
      const mockOrgKey = { [mockOrganizationId]: {} as any };

      organizationUserApiService.getAllUsers.mockResolvedValue(mockUsersResponse);
      apiService.getCollections.mockResolvedValue({
        data: [],
      } as any);
      keyService.orgKeys$.mockReturnValue(of(mockOrgKey));
      collectionService.decryptMany$.mockReturnValue(of([]));

      const result = await service.loadUsers(organization);

      expect(result).toHaveLength(1);
      expect(result[0].collectionNames).toEqual([]);
    });

    it("should fetch data in parallel using Promise.all", async () => {
      const organization = createMockOrganization({ useGroups: true });
      const mockUsersResponse: ListResponse<OrganizationUserUserDetailsResponse> = {
        data: [],
      } as any;

      let getUsersCallTime: number;
      let getGroupsCallTime: number;

      organizationUserApiService.getAllUsers.mockImplementation(async () => {
        getUsersCallTime = Date.now();
        return mockUsersResponse;
      });

      groupService.getAll.mockImplementation(async () => {
        getGroupsCallTime = Date.now();
        return [];
      });

      await service.loadUsers(organization);

      // Both calls should have been initiated at roughly the same time (within 50ms)
      expect(Math.abs(getUsersCallTime - getGroupsCallTime)).toBeLessThan(50);
    });
  });
});
