import { BaseResponse } from "@bitwarden/common/models/response/base.response";

class BaseAccessPolicyResponse extends BaseResponse {
  read: boolean;
  write: boolean;

  constructor(response: any) {
    super(response);
    this.read = this.getResponseProperty("Read");
    this.write = this.getResponseProperty("Write");
  }
}

export class UserAccessPolicyResponse extends BaseAccessPolicyResponse {
  organizationUserId: string;
  organizationUserName: string;
  currentUser: boolean;

  constructor(response: any) {
    super(response);
    this.organizationUserId = this.getResponseProperty("OrganizationUserId");
    this.organizationUserName = this.getResponseProperty("OrganizationUserName");
    this.currentUser = this.getResponseProperty("CurrentUser");
  }
}

export class GroupAccessPolicyResponse extends BaseAccessPolicyResponse {
  groupId: string;
  groupName: string;
  currentUserInGroup: boolean;

  constructor(response: any) {
    super(response);
    this.groupId = this.getResponseProperty("GroupId");
    this.groupName = this.getResponseProperty("GroupName");
    this.currentUserInGroup = this.getResponseProperty("CurrentUserInGroup");
  }
}

export class ServiceAccountAccessPolicyResponse extends BaseAccessPolicyResponse {
  serviceAccountId: string;
  serviceAccountName: string;

  constructor(response: any) {
    super(response);
    this.serviceAccountId = this.getResponseProperty("ServiceAccountId");
    this.serviceAccountName = this.getResponseProperty("ServiceAccountName");
  }
}

export class GrantedProjectAccessPolicyResponse extends BaseAccessPolicyResponse {
  grantedProjectId: string;
  grantedProjectName: string;

  constructor(response: any) {
    super(response);
    this.grantedProjectId = this.getResponseProperty("GrantedProjectId");
    this.grantedProjectName = this.getResponseProperty("GrantedProjectName");
  }
}
