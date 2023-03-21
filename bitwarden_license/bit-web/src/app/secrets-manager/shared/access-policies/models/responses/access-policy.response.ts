import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { Guid } from "@bitwarden/common/types/guid";

export class BaseAccessPolicyResponse extends BaseResponse {
  id: Guid;
  read: boolean;
  write: boolean;
  creationDate: string;
  revisionDate: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.read = this.getResponseProperty("Read");
    this.write = this.getResponseProperty("Write");
    this.creationDate = this.getResponseProperty("CreationDate");
    this.revisionDate = this.getResponseProperty("RevisionDate");
  }
}

export class UserProjectAccessPolicyResponse extends BaseAccessPolicyResponse {
  organizationUserId: Guid;
  organizationUserName: string;
  grantedProjectId: Guid;
  userId: Guid;

  constructor(response: any) {
    super(response);
    this.organizationUserId = this.getResponseProperty("OrganizationUserId");
    this.organizationUserName = this.getResponseProperty("OrganizationUserName");
    this.grantedProjectId = this.getResponseProperty("GrantedProjectId");
    this.userId = this.getResponseProperty("UserId");
  }
}

export class UserServiceAccountAccessPolicyResponse extends BaseAccessPolicyResponse {
  organizationUserId: Guid;
  organizationUserName: string;
  grantedServiceAccountId: Guid;
  userId: Guid;

  constructor(response: any) {
    super(response);
    this.organizationUserId = this.getResponseProperty("OrganizationUserId");
    this.organizationUserName = this.getResponseProperty("OrganizationUserName");
    this.grantedServiceAccountId = this.getResponseProperty("GrantedServiceAccountId");
    this.userId = this.getResponseProperty("UserId");
  }
}

export class GroupProjectAccessPolicyResponse extends BaseAccessPolicyResponse {
  groupId: Guid;
  groupName: string;
  grantedProjectId: Guid;
  currentUserInGroup: boolean;

  constructor(response: any) {
    super(response);
    this.groupId = this.getResponseProperty("GroupId");
    this.groupName = this.getResponseProperty("GroupName");
    this.grantedProjectId = this.getResponseProperty("GrantedProjectId");
    this.currentUserInGroup = this.getResponseProperty("CurrentUserInGroup");
  }
}

export class GroupServiceAccountAccessPolicyResponse extends BaseAccessPolicyResponse {
  groupId: Guid;
  groupName: string;
  grantedServiceAccountId: Guid;
  currentUserInGroup: boolean;

  constructor(response: any) {
    super(response);
    this.groupId = this.getResponseProperty("GroupId");
    this.groupName = this.getResponseProperty("GroupName");
    this.grantedServiceAccountId = this.getResponseProperty("GrantedServiceAccountId");
    this.currentUserInGroup = this.getResponseProperty("CurrentUserInGroup");
  }
}

export class ServiceAccountProjectAccessPolicyResponse extends BaseAccessPolicyResponse {
  serviceAccountId: Guid;
  serviceAccountName: string;
  grantedProjectId: Guid;
  grantedProjectName: string;

  constructor(response: any) {
    super(response);
    this.serviceAccountId = this.getResponseProperty("ServiceAccountId");
    this.serviceAccountName = this.getResponseProperty("ServiceAccountName");
    this.grantedProjectId = this.getResponseProperty("GrantedProjectId");
    this.grantedProjectName = this.getResponseProperty("GrantedProjectName");
  }
}
