import { SecretListView } from "@bitwarden/bit-common/secrets-manager/models/view/secret-list.view";
import { SecretProjectView } from "@bitwarden/bit-common/secrets-manager/models/view/secret-project.view";
import { SecretView } from "@bitwarden/bit-common/secrets-manager/models/view/secret.view";
import { BaseResponse } from "@bitwarden/cli/models/response/base.response";

export class SmSecretProjectResponse {
  id: string;
  name: string;

  constructor(project: SecretProjectView) {
    this.id = project.id;
    this.name = project.name;
  }
}

/**
 * A Secrets Manager secret. `value` and `note` are only present when a single secret is
 * fetched; list endpoints return names only.
 */
export class SmSecretResponse implements BaseResponse {
  object = "sm-secret";

  id: string;
  organizationId: string;
  key: string;
  value?: string;
  note?: string;
  projects: SmSecretProjectResponse[];
  creationDate: string;
  revisionDate: string;
  read: boolean;
  write: boolean;

  constructor(secret: SecretView | SecretListView) {
    this.id = secret.id;
    this.organizationId = secret.organizationId;
    this.key = secret.name;
    if (secret instanceof SecretView) {
      this.value = secret.value;
      this.note = secret.note;
    }
    this.projects = (secret.projects ?? []).map((p) => new SmSecretProjectResponse(p));
    this.creationDate = secret.creationDate;
    this.revisionDate = secret.revisionDate;
    this.read = secret.read;
    this.write = secret.write;
  }
}
