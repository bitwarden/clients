import {
  OrganizationUserStatusType,
  OrganizationUserType,
} from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { SelectionReadOnlyResponse } from "@bitwarden/common/admin-console/models/response/selection-read-only.response";
import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { KdfType } from "@bitwarden/key-management";

export class OrganizationUserResponse extends BaseResponse {
  id: string;
  userId: string;
  type: OrganizationUserType;
  status: OrganizationUserStatusType;
  externalId: string;
  accessSecretsManager: boolean;
  permissions: PermissionsApi;
  resetPasswordEnrolled: boolean;
  hasMasterPassword: boolean;
  collections: SelectionReadOnlyResponse[] = [];
  groups: string[] = [];

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.userId = this.getResponseProperty("UserId");
    this.type = this.getResponseProperty("Type");
    this.status = this.getResponseProperty("Status");
    this.permissions = new PermissionsApi(this.getResponseProperty("Permissions"));
    this.externalId = this.getResponseProperty("ExternalId");
    this.accessSecretsManager = this.getResponseProperty("AccessSecretsManager");
    this.resetPasswordEnrolled = this.getResponseProperty("ResetPasswordEnrolled");
    this.hasMasterPassword = this.getResponseProperty("HasMasterPassword");

    const collections = this.getResponseProperty("Collections");
    if (collections != null) {
      this.collections = collections.map((c: any) => new SelectionReadOnlyResponse(c));
    }
    const groups = this.getResponseProperty("Groups");
    if (groups != null) {
      this.groups = groups;
    }
  }
}

export class OrganizationUserUserDetailsResponse extends OrganizationUserResponse {
  name: string;
  email: string;
  avatarColor: string;
  twoFactorEnabled: boolean;
  usesKeyConnector: boolean;
  managedByOrganization: boolean;

  constructor(response: any) {
    super(response);
    this.name = this.getResponseProperty("Name");
    this.email = this.getResponseProperty("Email");
    this.avatarColor = this.getResponseProperty("AvatarColor");
    this.twoFactorEnabled = this.getResponseProperty("TwoFactorEnabled");
    this.usesKeyConnector = this.getResponseProperty("UsesKeyConnector") ?? false;
    this.managedByOrganization = this.getResponseProperty("ManagedByOrganization") ?? false;
  }
}

export class OrganizationUserDetailsResponse extends OrganizationUserResponse {
  managedByOrganization: boolean;
  ssoExternalId: string;

  constructor(response: any) {
    super(response);
    this.managedByOrganization = this.getResponseProperty("ManagedByOrganization") ?? false;
    this.ssoExternalId = this.getResponseProperty("SsoExternalId");
  }
}

export class OrganizationUserResetPasswordDetailsResponse extends BaseResponse {
  organizationUserId: string;
  kdf: KdfType;
  kdfIterations: number;
  kdfMemory?: number;
  kdfParallelism?: number;
  resetPasswordKey: string;
  encryptedPrivateKey: string;

  constructor(response: any) {
    super(response);
    this.organizationUserId = this.getResponseProperty("OrganizationUserId");
    this.kdf = this.getResponseProperty("Kdf");
    this.kdfIterations = this.getResponseProperty("KdfIterations");
    this.kdfMemory = this.getResponseProperty("KdfMemory");
    this.kdfParallelism = this.getResponseProperty("KdfParallelism");
    this.resetPasswordKey = this.getResponseProperty("ResetPasswordKey");
    this.encryptedPrivateKey = this.getResponseProperty("EncryptedPrivateKey");
  }
}
