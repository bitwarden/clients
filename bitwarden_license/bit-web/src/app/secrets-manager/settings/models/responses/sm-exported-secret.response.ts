import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { Guid } from "@bitwarden/common/types/guid";

export class SecretsManagerExportedSecretResponse extends BaseResponse {
  id: Guid;
  key: string;
  value: string;
  note: string;
  projectIds: Guid[];

  constructor(response: any) {
    super(response);

    this.id = this.getResponseProperty("Id");
    this.key = this.getResponseProperty("Key");
    this.value = this.getResponseProperty("Value");
    this.note = this.getResponseProperty("Note");

    const projectIds = this.getResponseProperty<Guid[]>("ProjectIds");
    this.projectIds = projectIds?.map((id: any) => id.toString());
  }
}
