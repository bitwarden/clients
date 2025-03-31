// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
class BaseAccessPolicyView {
  read: boolean;
  write: boolean;
}

export class UserAccessPolicyView extends BaseAccessPolicyView {
  organizationUserId: string;
  organizationUserName: string;
  currentUser: boolean;
}

export class GroupAccessPolicyView extends BaseAccessPolicyView {
  groupId: string;
  groupName: string;
  currentUserInGroup: boolean;
}

export class ServiceAccountAccessPolicyView extends BaseAccessPolicyView {
  serviceAccountId: string;
  serviceAccountName: string;
}

export class GrantedProjectAccessPolicyView extends BaseAccessPolicyView {
  grantedProjectId: string;
  grantedProjectName: string;
}
