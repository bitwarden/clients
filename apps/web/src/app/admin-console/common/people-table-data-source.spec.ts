import { DestroyRef } from "@angular/core";
import { fakeAsync, TestBed, tick } from "@angular/core/testing";
import { BehaviorSubject } from "rxjs";

import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";

import { PeopleTableDataSource, MaxBulkReinviteCount } from "./people-table-data-source";

// Mock user type for testing
// We use 'any' cast in the class to bypass strict type checking since this is just for testing
interface MockUser {
  id: string;
  name: string;
  email: string;
  status: OrganizationUserStatusType;
  checked?: boolean;
}

// Concrete implementation for testing
class TestPeopleTableDataSource extends PeopleTableDataSource<any> {
  protected statusType = OrganizationUserStatusType;
}

describe("PeopleTableDataSource", () => {
  let dataSource: TestPeopleTableDataSource;
  let configService: jest.Mocked<ConfigService>;
  let environmentService: jest.Mocked<EnvironmentService>;
  let destroyRef: DestroyRef;
  let featureFlagSubject: BehaviorSubject<boolean>;
  let environmentSubject: BehaviorSubject<Environment>;

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
    featureFlagSubject = new BehaviorSubject<boolean>(false);
    environmentSubject = new BehaviorSubject<Environment>({
      isCloud: () => false,
    } as Environment);

    configService = {
      getFeatureFlag$: jest.fn().mockReturnValue(featureFlagSubject.asObservable()),
    } as any;

    environmentService = {
      environment$: environmentSubject.asObservable(),
    } as any;

    TestBed.configureTestingModule({
      providers: [
        { provide: ConfigService, useValue: configService },
        { provide: EnvironmentService, useValue: environmentService },
      ],
    });

    destroyRef = TestBed.inject(DestroyRef);
    dataSource = new TestPeopleTableDataSource(configService, environmentService, destroyRef);
  });

  describe("enforceCheckedUserLimit", () => {
    it("should return all users when under the limit", () => {
      const users = createMockUsers(10, true);
      dataSource.data = users;

      const result = dataSource.enforceCheckedUserLimit();

      expect(result).toHaveLength(10);
      expect(result).toEqual(users);
      // All users should remain checked
      expect(users.every((u) => u.checked)).toBe(true);
    });

    it("should limit to 500 by default when over the limit", () => {
      const users = createMockUsers(600, true);
      dataSource.data = users;

      const result = dataSource.enforceCheckedUserLimit();

      expect(result).toHaveLength(500);
      // First 500 should be returned
      expect(result).toEqual(users.slice(0, 500));
      // First 500 should remain checked
      expect(users.slice(0, 500).every((u) => u.checked)).toBe(true);
      // Remaining 100 should be unchecked
      expect(users.slice(500).every((u) => !u.checked)).toBe(true);
    });

    it("should limit to MaxBulkReinviteCount (4000) when feature flag enabled and cloud", fakeAsync(() => {
      // Enable feature flag and cloud environment
      featureFlagSubject.next(true);
      environmentSubject.next({
        isCloud: () => true,
      } as Environment);

      // Allow subscription to process
      tick();

      const users = createMockUsers(4500, true);
      dataSource.data = users;

      const result = dataSource.enforceCheckedUserLimit(MaxBulkReinviteCount);

      expect(result).toHaveLength(4000);
      // First 4000 should be returned
      expect(result).toEqual(users.slice(0, 4000));
      // First 4000 should remain checked
      expect(users.slice(0, 4000).every((u) => u.checked)).toBe(true);
      // Remaining 500 should be unchecked
      expect(users.slice(4000).every((u) => !u.checked)).toBe(true);
    }));

    it("should uncheck users beyond the limit", () => {
      const users = createMockUsers(550, true);
      dataSource.data = users;

      dataSource.enforceCheckedUserLimit();

      // First 500 should remain checked
      users.slice(0, 500).forEach((user) => {
        expect(user.checked).toBe(true);
      });
      // Last 50 should be unchecked
      users.slice(500).forEach((user) => {
        expect(user.checked).toBe(false);
      });
    });

    it("should respect requested limit when lower than max allowed", () => {
      const users = createMockUsers(300, true);
      dataSource.data = users;

      const result = dataSource.enforceCheckedUserLimit(200);

      expect(result).toHaveLength(200);
      expect(result).toEqual(users.slice(0, 200));
      // First 200 should remain checked
      expect(users.slice(0, 200).every((u) => u.checked)).toBe(true);
      // Remaining 100 should be unchecked
      expect(users.slice(200).every((u) => !u.checked)).toBe(true);
    });

    it("should respect max allowed when requested limit is higher", () => {
      // Max allowed is 500 by default (feature flag disabled)
      const users = createMockUsers(600, true);
      dataSource.data = users;

      // Request 550, but should be capped to 500
      const result = dataSource.enforceCheckedUserLimit(550);

      expect(result).toHaveLength(500);
      expect(result).toEqual(users.slice(0, 500));
    });

    it("should handle empty selection", () => {
      const users = createMockUsers(100, false);
      dataSource.data = users;

      const result = dataSource.enforceCheckedUserLimit();

      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
      // All users should remain unchecked
      expect(users.every((u) => !u.checked)).toBe(true);
    });

    it("should handle exactly at limit", () => {
      const users = createMockUsers(500, true);
      dataSource.data = users;

      const result = dataSource.enforceCheckedUserLimit();

      expect(result).toHaveLength(500);
      expect(result).toEqual(users);
      // All users should remain checked
      expect(users.every((u) => u.checked)).toBe(true);
    });

    it("should handle mixed checked/unchecked users", () => {
      const users = createMockUsers(600);
      // Check the first 550
      users.slice(0, 550).forEach((u) => (u.checked = true));
      dataSource.data = users;

      const result = dataSource.enforceCheckedUserLimit();

      expect(result).toHaveLength(500);
      // Should return first 500 of the checked users
      expect(result.every((u) => u.checked)).toBe(true);
      // 50 checked users should be unchecked
      expect(users.slice(500, 550).every((u) => !u.checked)).toBe(true);
      // Last 50 should remain unchecked
      expect(users.slice(550).every((u) => !u.checked)).toBe(true);
    });

    it("should not affect unchecked users when limiting", () => {
      const users = createMockUsers(600);
      // Check only 100 users in the middle
      users.slice(200, 300).forEach((u) => (u.checked = true));
      dataSource.data = users;

      const result = dataSource.enforceCheckedUserLimit();

      expect(result).toHaveLength(100);
      // Only the 100 checked users should be returned
      expect(result).toEqual(users.slice(200, 300));
      // Users before and after should remain unchecked
      expect(users.slice(0, 200).every((u) => !u.checked)).toBe(true);
      expect(users.slice(300).every((u) => !u.checked)).toBe(true);
    });

    it("should work correctly on multiple calls", () => {
      const users = createMockUsers(600, true);
      dataSource.data = users;

      // First call
      const result1 = dataSource.enforceCheckedUserLimit();
      expect(result1).toHaveLength(500);

      // Second call should return the same 500 (since last 100 are now unchecked)
      const result2 = dataSource.enforceCheckedUserLimit();
      expect(result2).toHaveLength(500);
      expect(result2).toEqual(result1);
    });

    it("should cap to 500 when feature flag enabled but not on cloud", fakeAsync(() => {
      // Enable feature flag but keep self-hosted
      featureFlagSubject.next(true);
      environmentSubject.next({
        isCloud: () => false,
      } as Environment);

      // Allow subscription to process
      tick();

      const users = createMockUsers(600, true);
      dataSource.data = users;

      const result = dataSource.enforceCheckedUserLimit(MaxBulkReinviteCount);

      // Should be capped to 500, not 4000
      expect(result).toHaveLength(500);
    }));

    it("should cap to 500 when on cloud but feature flag disabled", fakeAsync(() => {
      // Keep feature flag disabled but set cloud
      featureFlagSubject.next(false);
      environmentSubject.next({
        isCloud: () => true,
      } as Environment);

      // Allow subscription to process
      tick();

      const users = createMockUsers(600, true);
      dataSource.data = users;

      const result = dataSource.enforceCheckedUserLimit(MaxBulkReinviteCount);

      // Should be capped to 500, not 4000
      expect(result).toHaveLength(500);
    }));
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
