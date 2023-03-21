import { Guid } from "@bitwarden/common/types/guid";

export class BaseAccessPolicyView {
  id: Guid;
  read: boolean;
  write: boolean;
  creationDate: string;
  revisionDate: string;
}

export class UserProjectAccessPolicyView extends BaseAccessPolicyView {
  organizationUserId: Guid;
  organizationUserName: string;
  grantedProjectId: Guid;
  userId: Guid;
}

export class UserServiceAccountAccessPolicyView extends BaseAccessPolicyView {
  organizationUserId: Guid;
  organizationUserName: string;
  grantedServiceAccountId: Guid;
  userId: Guid;
}

export class GroupProjectAccessPolicyView extends BaseAccessPolicyView {
  groupId: Guid;
  groupName: string;
  grantedProjectId: Guid;
  currentUserInGroup: boolean;
}

export class GroupServiceAccountAccessPolicyView extends BaseAccessPolicyView {
  groupId: Guid;
  groupName: string;
  grantedServiceAccountId: Guid;
  currentUserInGroup: boolean;
}

export class ServiceAccountProjectAccessPolicyView extends BaseAccessPolicyView {
  serviceAccountId: Guid;
  serviceAccountName: string;
  grantedProjectId: Guid;
  grantedProjectName: string;
}

export class ProjectAccessPoliciesView {
  userAccessPolicies: UserProjectAccessPolicyView[];
  groupAccessPolicies: GroupProjectAccessPolicyView[];
  serviceAccountAccessPolicies: ServiceAccountProjectAccessPolicyView[];
}

export class ServiceAccountAccessPoliciesView {
  userAccessPolicies: UserServiceAccountAccessPolicyView[];
  groupAccessPolicies: GroupServiceAccountAccessPolicyView[];
}
