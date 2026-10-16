import { SecretVersionView } from "@bitwarden/bit-common/secrets-manager/models/view/secret-version.view";
import { BaseResponse } from "@bitwarden/cli/models/response/base.response";

export class SmSecretVersionResponse implements BaseResponse {
  object = "sm-secret-version";

  id: string;
  secretId: string;
  value: string;
  versionDate: string;
  authorName?: string;

  constructor(version: SecretVersionView) {
    this.id = version.id;
    this.secretId = version.secretId;
    this.value = version.value;
    this.versionDate = version.versionDate;
    this.authorName = version.authorName;
  }
}
