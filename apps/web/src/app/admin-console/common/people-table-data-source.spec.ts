import { TestBed } from "@angular/core/testing";
import { ReplaySubject } from "rxjs";

import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";

import { PeopleTableDataSource } from "./people-table-data-source";

interface MockUser {
  id: string;
  name: string;
  email: string;
  status: OrganizationUserStatusType;
  checked?: boolean;
}

class TestPeopleTableDataSource extends PeopleTableDataSource<any> {
  protected statusType = OrganizationUserStatusType;
}

describe("PeopleTableDataSource", () => {
  let dataSource: TestPeopleTableDataSource;

  const createMockUser = (id: string, checked: boolean = false): MockUser => ({
    id,
    name: `User ${id}`,
    email: `user${id}@example.com`,
    status: OrganizationUserStatusType.Confirmed,
    checked,
  });

  const createMockUsers = (count: number, checked: boolean = false): MockUser[] => {
    return Array.from({ length: count }, (_, i) => createMockUser(`${i + 1}`, checked));
  };

  beforeEach(() => {
    const featureFlagSubject = new ReplaySubject<boolean>(1);
    featureFlagSubject.next(false);

    const environmentSubject = new ReplaySubject<Environment>(1);
    environmentSubject.next({
      isCloud: () => false,
    } as Environment);

    const mockEnvironmentService = {
      environment$: environmentSubject.asObservable(),
    } as any;

    TestBed.configureTestingModule({
      providers: [{ provide: EnvironmentService, useValue: mockEnvironmentService }],
    });

    dataSource = TestBed.runInInjectionContext(
      () => new TestPeopleTableDataSource(mockEnvironmentService),
    );
  });

  describe("limitAndUncheckExcess", () => {
    it("should return all users when under limit", () => {
      const users = createMockUsers(10, true);
      dataSource.data = users;

      const result = dataSource.limitAndUncheckExcess(users, 500);

      expect(result).toHaveLength(10);
      expect(result).toEqual(users);
      expect(users.every((u) => u.checked)).toBe(true);
    });

    it("should limit users and uncheck excess", () => {
      const users = createMockUsers(600, true);
      dataSource.data = users;

      const result = dataSource.limitAndUncheckExcess(users, 500);

      expect(result).toHaveLength(500);
      expect(result).toEqual(users.slice(0, 500));
      expect(users.slice(0, 500).every((u) => u.checked)).toBe(true);
      expect(users.slice(500).every((u) => u.checked)).toBe(false);
    });

    it("should only affect users in the provided array", () => {
      const allUsers = createMockUsers(1000, true);
      dataSource.data = allUsers;

      // Pass only a subset (simulates filtering by status)
      const subset = allUsers.slice(0, 600);

      const result = dataSource.limitAndUncheckExcess(subset, 500);

      expect(result).toHaveLength(500);
      expect(subset.slice(0, 500).every((u) => u.checked)).toBe(true);
      expect(subset.slice(500).every((u) => u.checked)).toBe(false);
      // Users outside subset remain checked
      expect(allUsers.slice(600).every((u) => u.checked)).toBe(true);
    });
  });

  describe("status counts", () => {
    it("should correctly count users by status", () => {
      const users: MockUser[] = [
        { ...createMockUser("1"), status: OrganizationUserStatusType.Invited },
        { ...createMockUser("2"), status: OrganizationUserStatusType.Invited },
        { ...createMockUser("3"), status: OrganizationUserStatusType.Accepted },
        { ...createMockUser("4"), status: OrganizationUserStatusType.Confirmed },
        { ...createMockUser("5"), status: OrganizationUserStatusType.Confirmed },
        { ...createMockUser("6"), status: OrganizationUserStatusType.Confirmed },
        { ...createMockUser("7"), status: OrganizationUserStatusType.Revoked },
      ];
      dataSource.data = users;

      expect(dataSource.invitedUserCount).toBe(2);
      expect(dataSource.acceptedUserCount).toBe(1);
      expect(dataSource.confirmedUserCount).toBe(3);
      expect(dataSource.revokedUserCount).toBe(1);
      expect(dataSource.activeUserCount).toBe(6); // All except revoked
    });
  });
});
