import { Observable, startWith, map } from "rxjs";

import {
  OrganizationUserStatusType,
  ProviderUserStatusType,
} from "@bitwarden/common/admin-console/enums";
import { ProviderUserUserDetailsResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-user.response";

import { OrganizationUserView } from "../organizations/core/views/organization-user.view";

import { PeopleTableDataSource } from "./people-table-data-source";

export type StatusType = OrganizationUserStatusType | ProviderUserStatusType;

export type UserViewTypes = ProviderUser | OrganizationUserView;
export type ProviderUser = ProviderUserUserDetailsResponse;

export class ProvidersTableDataSource extends PeopleTableDataSource<ProviderUser> {
  protected statusType = ProviderUserStatusType;
}

export class MembersTableDataSource extends PeopleTableDataSource<OrganizationUserView> {
  protected statusType = OrganizationUserStatusType;
}

export interface BulkFlags {
  showConfirmUsers: boolean;
  showBulkConfirmUsers: boolean;
  showBulkReinviteUsers: boolean;
}

export interface BulkMemberFlags extends BulkFlags {
  showBulkRestoreUsers: boolean;
  showBulkRevokeUsers: boolean;
  showBulkRemoveUsers: boolean;
  showBulkDeleteUsers: boolean;
}

export function configureMemberFlags(
  dataSource: MembersTableDataSource,
): Observable<BulkMemberFlags> {
  return dataSource.usersUpdated().pipe(
    startWith(null), // initial emission to kick off reactive member options menu actions
    map(() => {
      const checkedUsers = dataSource.getCheckedUsers();
      const result = {
        showConfirmUsers: showConfirm(dataSource),
        showBulkConfirmUsers: true,
        showBulkReinviteUsers: true,
        showBulkRestoreUsers: true,
        showBulkRevokeUsers: true,
        showBulkRemoveUsers: true,
        showBulkDeleteUsers: true,
      };

      if (checkedUsers.length) {
        checkedUsers.forEach((member) => {
          if (member.status !== OrganizationUserStatusType.Accepted) {
            result.showBulkConfirmUsers = false;
          }
          if (member.status !== OrganizationUserStatusType.Invited) {
            result.showBulkReinviteUsers = false;
          }
          if (member.status !== OrganizationUserStatusType.Revoked) {
            result.showBulkRestoreUsers = false;
          }
          if (member.status == OrganizationUserStatusType.Revoked) {
            result.showBulkRevokeUsers = false;
          }

          result.showBulkRemoveUsers = !member.managedByOrganization;

          const validStatuses = [
            OrganizationUserStatusType.Accepted,
            OrganizationUserStatusType.Confirmed,
            OrganizationUserStatusType.Revoked,
          ];

          result.showBulkDeleteUsers =
            member.managedByOrganization && validStatuses.includes(member.status);
        });
      }

      return result;
    }),
  );
}

export function configureProviderMemberFlags(
  dataSource: ProvidersTableDataSource,
): Observable<BulkFlags> {
  return dataSource.usersUpdated().pipe(
    startWith(null), // initial emission to kick off reactive member options menu actions
    map(() => {
      const result: BulkFlags = {
        showConfirmUsers: showConfirm(dataSource),
        showBulkConfirmUsers: true,
        showBulkReinviteUsers: true,
      };
      const checkedUsers = dataSource.getCheckedUsers();

      checkedUsers.forEach((provider) => {
        if (provider.status !== ProviderUserStatusType.Accepted) {
          result.showBulkConfirmUsers = false;
        }

        if (provider.status !== ProviderUserStatusType.Invited) {
          result.showBulkReinviteUsers = false;
        }
      });

      return result;
    }),
  );
}

function showConfirm(dataSource: ProvidersTableDataSource | MembersTableDataSource): boolean {
  return (
    dataSource.activeUserCount > 1 &&
    dataSource.confirmedUserCount > 0 &&
    dataSource.confirmedUserCount < 3 &&
    dataSource.acceptedUserCount > 0
  );
}
