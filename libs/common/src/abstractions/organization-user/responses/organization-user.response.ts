import { KdfType } from "../../../enums/kdfType";
import { OrganizationUserStatusType } from "../../../enums/organizationUserStatusType";
import { OrganizationUserType } from "../../../enums/organizationUserType";
import { PermissionsApi } from "../../../models/api/permissions.api";
import { BaseResponse } from "../../../models/response/base.response";
import { SelectionReadOnlyResponse } from "../../../models/response/selection-read-only.response";
import { Guid } from "../../../types/guid";

export class OrganizationUserResponse extends BaseResponse {
  id: Guid;
  userId: Guid;
  type: OrganizationUserType;
  status: OrganizationUserStatusType;
  externalId: string;
  accessAll: boolean;
  accessSecretsManager: boolean;
  permissions: PermissionsApi;
  resetPasswordEnrolled: boolean;
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
    this.accessAll = this.getResponseProperty("AccessAll");
    this.accessSecretsManager = this.getResponseProperty("AccessSecretsManager");
    this.resetPasswordEnrolled = this.getResponseProperty("ResetPasswordEnrolled");

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

  constructor(response: any) {
    super(response);
    this.name = this.getResponseProperty("Name");
    this.email = this.getResponseProperty("Email");
    this.avatarColor = this.getResponseProperty("AvatarColor");
    this.twoFactorEnabled = this.getResponseProperty("TwoFactorEnabled");
    this.usesKeyConnector = this.getResponseProperty("UsesKeyConnector") ?? false;
  }
}

export class OrganizationUserDetailsResponse extends OrganizationUserResponse {
  constructor(response: any) {
    super(response);
  }
}

export class OrganizationUserResetPasswordDetailsReponse extends BaseResponse {
  kdf: KdfType;
  kdfIterations: number;
  kdfMemory?: number;
  kdfParallelism?: number;
  resetPasswordKey: string;
  encryptedPrivateKey: string;

  constructor(response: any) {
    super(response);
    this.kdf = this.getResponseProperty("Kdf");
    this.kdfIterations = this.getResponseProperty("KdfIterations");
    this.kdfMemory = this.getResponseProperty("KdfMemory");
    this.kdfParallelism = this.getResponseProperty("KdfParallelism");
    this.resetPasswordKey = this.getResponseProperty("ResetPasswordKey");
    this.encryptedPrivateKey = this.getResponseProperty("EncryptedPrivateKey");
  }
}
