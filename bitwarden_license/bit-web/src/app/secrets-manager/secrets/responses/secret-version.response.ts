import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class SecretVersionResponse extends BaseResponse {
  id: string;
  secretId: string;
  value: string;
  versionDate: string;
  editorServiceAccountId: string;
  editorOrganizationUserId: string;
  editorName: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.secretId = this.getResponseProperty("SecretId");
    this.value = this.getResponseProperty("Value");
    this.versionDate = this.getResponseProperty("VersionDate");
    this.editorServiceAccountId = this.getResponseProperty("EditorServiceAccountId");
    this.editorOrganizationUserId = this.getResponseProperty("EditorOrganizationUserId");
    this.editorName = this.getResponseProperty("EditorName");
  }
}
