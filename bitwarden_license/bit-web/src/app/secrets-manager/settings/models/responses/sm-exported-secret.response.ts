import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class SecretsManagerExportedSecretResponse extends BaseResponse {
  id: string;
  key: string;
  value: string;
  note: string;
  projectIds: string[];

  constructor(response: any) {
    super(response);

    this.id = this.getResponseProperty("Id");
    this.key = this.getResponseProperty("Key");
    this.value = this.getResponseProperty("Value");
    this.note = this.getResponseProperty("Note");

    const projectIds = this.getResponseProperty("ProjectIds");
    this.projectIds = projectIds?.map((id: any) => id.toString());
  }
}
