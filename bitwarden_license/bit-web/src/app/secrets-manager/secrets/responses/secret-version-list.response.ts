import { BaseResponse } from "@bitwarden/common/models/response/base.response";

import { SecretVersionResponse } from "./secret-version.response";

export class SecretVersionListResponse extends BaseResponse {
  versions: SecretVersionResponse[];

  constructor(response: any) {
    super(response);
    const versions = this.getResponseProperty("Data");
    this.versions = versions == null ? [] : versions.map((v: any) => new SecretVersionResponse(v));
  }
}
