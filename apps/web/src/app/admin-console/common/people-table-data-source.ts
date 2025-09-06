// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  OrganizationUserStatusType,
  ProviderUserStatusType,
} from "@bitwarden/common/admin-console/enums";
import { TableDataSource } from "@bitwarden/components";

import { StatusType, UserViewTypes } from "./base-members.component";

const MaxCheckedCount = 500;

/**
 * Returns true if the user matches the status, or where the status is `null`, if the user is active (not revoked).
 */
function statusFilter(user: UserViewTypes, status?: StatusType) {
  if (status == null) {
    return user.status != OrganizationUserStatusType.Revoked;
  }

  return user.status === status;
}

/**
 * Returns true if the string matches the user's id, name, or email.
 * (The default string search includes all properties, which can return false positives for collection names etc.)
 */
function textFilter(user: UserViewTypes, text: string) {
  const normalizedText = text?.toLowerCase();
  return (
    !normalizedText || // null/empty strings should be ignored, i.e. always return true
    user.email.toLowerCase().includes(normalizedText) ||
    user.id.toLowerCase().includes(normalizedText) ||
    user.name?.toLowerCase().includes(normalizedText)
  );
}

export function peopleFilter(searchText: string, status?: StatusType) {
  return (user: UserViewTypes) => statusFilter(user, status) && textFilter(user, searchText);
}

/**
 * An extended TableDataSource class for managing people (organization members and provider users).
 * It includes a tally of different statuses, utility methods, and other common functionality.
 */
export abstract class PeopleTableDataSource<T extends UserViewTypes> extends TableDataSource<T> {
  protected abstract statusType: typeof OrganizationUserStatusType | typeof ProviderUserStatusType;

  /**
   * The number of 'active' users, that is, all users who are not in a revoked status.
   */
  activeUserCount: number;

  invitedUserCount: number;
  acceptedUserCount: number;
  confirmedUserCount: number;
  revokedUserCount: number;

  override set data(data: T[]) {
    super.data = data;

    this.activeUserCount =
      this.data?.filter((u) => u.status !== this.statusType.Revoked).length ?? 0;

    this.invitedUserCount =
      this.data?.filter((u) => u.status === this.statusType.Invited).length ?? 0;
    this.acceptedUserCount =
      this.data?.filter((u) => u.status === this.statusType.Accepted).length ?? 0;
    this.confirmedUserCount =
      this.data?.filter((u) => u.status === this.statusType.Confirmed).length ?? 0;
    this.revokedUserCount =
      this.data?.filter((u) => u.status === this.statusType.Revoked).length ?? 0;
  }

  override get data() {
    // If you override a setter, you must also override the getter
    return super.data;
  }

  /**
   * Check or uncheck a user in the table
   * @param select check the user (true), uncheck the user (false), or toggle the current state (null)
   */
  checkUser(user: T, select?: boolean) {
    (user as any).checked = select == null ? !(user as any).checked : select;
  }

  getCheckedUsers() {
    return this.data.filter((u) => (u as any).checked);
  }

  /**
   * Check all filtered users (i.e. those rows that are currently visible)
   * @param select check the filtered users (true) or uncheck the filtered users (false)
   */
  checkAllFilteredUsers(select: boolean) {
    if (select) {
      // Reset checkbox selection first so we know nothing else is selected
      this.uncheckAllUsers();
    }

    const filteredUsers = this.filteredData;

    const selectCount =
      filteredUsers.length > MaxCheckedCount ? MaxCheckedCount : filteredUsers.length;
    for (let i = 0; i < selectCount; i++) {
      this.checkUser(filteredUsers[i], select);
    }
  }

  uncheckAllUsers() {
    this.data.forEach((u) => ((u as any).checked = false));
  }

  /**
   * Remove a user from the data source. Use this to ensure the table is re-rendered after the change.
   */
  removeUser(user: T) {
    // Note: use immutable functions so that we trigger setters to update the table
    this.data = this.data.filter((u) => u != user);
  }

  /**
   * Replace a user in the data source by matching on user.id. Use this to ensure the table is re-rendered after the change.
   */
  replaceUser(user: T) {
    const index = this.data.findIndex((u) => u.id === user.id);
    if (index > -1) {
      // Clone the array so that the setter for dataSource.data is triggered to update the table rendering
      const updatedData = this.data.slice();
      updatedData[index] = user;
      this.data = updatedData;
    }
  }
}
