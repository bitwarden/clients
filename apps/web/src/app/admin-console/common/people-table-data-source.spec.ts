import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";

import { OrganizationUserView } from "../organizations/core/views/organization-user.view";

import { PeopleTableDataSource } from "./people-table-data-source";

// Create a concrete implementation for testing
class TestPeopleTableDataSource extends PeopleTableDataSource<OrganizationUserView> {
  protected statusType = OrganizationUserStatusType;
}

describe("PeopleTableDataSource", () => {
  let dataSource: TestPeopleTableDataSource;

  beforeEach(() => {
    dataSource = new TestPeopleTableDataSource();
  });

  describe("checkAllFilteredUsers", () => {
    let mockUsers: OrganizationUserView[];

    beforeEach(() => {
      // Create 600 mock users to test the limit
      mockUsers = Array.from({ length: 600 }, (_, i) => ({
        id: `user-${i}`,
        email: `user${i}@example.com`,
        name: `User ${i}`,
        status: OrganizationUserStatusType.Confirmed,
      })) as OrganizationUserView[];

      dataSource.data = mockUsers;
    });

    it("should limit selection to 500 users when removeBatchLimit is false", () => {
      dataSource.checkAllFilteredUsers(true, false);

      const checkedUsers = dataSource.getCheckedUsers();
      expect(checkedUsers).toHaveLength(500);
    });

    it("should select all users when removeBatchLimit is true", () => {
      dataSource.checkAllFilteredUsers(true, true);

      const checkedUsers = dataSource.getCheckedUsers();
      expect(checkedUsers).toHaveLength(600);
    });

    it("should select all users when count is below 500 and removeBatchLimit is false", () => {
      // Use only 300 users
      const smallUserSet = mockUsers.slice(0, 300);
      dataSource.data = smallUserSet;

      dataSource.checkAllFilteredUsers(true, false);

      const checkedUsers = dataSource.getCheckedUsers();
      expect(checkedUsers).toHaveLength(300);
    });

    it("should select all users when count is below 500 and removeBatchLimit is true", () => {
      // Use only 300 users
      const smallUserSet = mockUsers.slice(0, 300);
      dataSource.data = smallUserSet;

      dataSource.checkAllFilteredUsers(true, true);

      const checkedUsers = dataSource.getCheckedUsers();
      expect(checkedUsers).toHaveLength(300);
    });

    it("should uncheck all users before selecting when select is true", () => {
      // First, manually check some users
      dataSource.checkUser(mockUsers[0], true);
      dataSource.checkUser(mockUsers[1], true);
      expect(dataSource.getCheckedUsers()).toHaveLength(2);

      // Now call checkAllFilteredUsers with select=true
      dataSource.checkAllFilteredUsers(true, false);

      // Should have exactly 500 checked (the limit), not 502
      const checkedUsers = dataSource.getCheckedUsers();
      expect(checkedUsers).toHaveLength(500);
    });

    it("should uncheck all users when select is false", () => {
      // First check all users
      dataSource.checkAllFilteredUsers(true, false);
      expect(dataSource.getCheckedUsers().length).toBeGreaterThan(0);

      // Now uncheck all
      dataSource.checkAllFilteredUsers(false, false);

      const checkedUsers = dataSource.getCheckedUsers();
      expect(checkedUsers).toHaveLength(0);
    });

    it("should handle exactly 500 users when removeBatchLimit is false", () => {
      const exactUsers = mockUsers.slice(0, 500);
      dataSource.data = exactUsers;

      dataSource.checkAllFilteredUsers(true, false);

      const checkedUsers = dataSource.getCheckedUsers();
      expect(checkedUsers).toHaveLength(500);
    });

    it("should handle exactly 500 users when removeBatchLimit is true", () => {
      const exactUsers = mockUsers.slice(0, 500);
      dataSource.data = exactUsers;

      dataSource.checkAllFilteredUsers(true, true);

      const checkedUsers = dataSource.getCheckedUsers();
      expect(checkedUsers).toHaveLength(500);
    });

    it("should work with filtered data when removeBatchLimit is true", () => {
      // Set up a filter that only includes some users
      dataSource.filter = "user-1"; // This will match user-1, user-10, user-11, etc.

      dataSource.checkAllFilteredUsers(true, true);

      const checkedUsers = dataSource.getCheckedUsers();
      // The number of checked users should equal the number of filtered users
      expect(checkedUsers.length).toBe(dataSource.filteredData.length);
    });

    it("should default removeBatchLimit to false when not provided", () => {
      dataSource.checkAllFilteredUsers(true);

      const checkedUsers = dataSource.getCheckedUsers();
      expect(checkedUsers).toHaveLength(500);
    });
  });

  describe("getCheckedUsers", () => {
    it("should return only checked users", () => {
      const users = Array.from({ length: 10 }, (_, i) => ({
        id: `user-${i}`,
        email: `user${i}@example.com`,
        name: `User ${i}`,
        status: OrganizationUserStatusType.Confirmed,
      })) as OrganizationUserView[];

      dataSource.data = users;

      // Check only a few users
      dataSource.checkUser(users[0], true);
      dataSource.checkUser(users[2], true);
      dataSource.checkUser(users[5], true);

      const checkedUsers = dataSource.getCheckedUsers();
      expect(checkedUsers).toHaveLength(3);
      expect(checkedUsers).toContain(users[0]);
      expect(checkedUsers).toContain(users[2]);
      expect(checkedUsers).toContain(users[5]);
    });
  });

  describe("uncheckAllUsers", () => {
    it("should uncheck all users", () => {
      const users = Array.from({ length: 10 }, (_, i) => ({
        id: `user-${i}`,
        email: `user${i}@example.com`,
        name: `User ${i}`,
        status: OrganizationUserStatusType.Confirmed,
      })) as OrganizationUserView[];

      dataSource.data = users;

      // Check all users
      users.forEach((user) => dataSource.checkUser(user, true));
      expect(dataSource.getCheckedUsers()).toHaveLength(10);

      // Uncheck all
      dataSource.uncheckAllUsers();

      expect(dataSource.getCheckedUsers()).toHaveLength(0);
    });
  });
});
