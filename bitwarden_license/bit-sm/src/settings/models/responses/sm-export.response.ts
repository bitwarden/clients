import { BaseResponse } from "@bitwarden/common/models/response/base.response";

import { SecretsManagerExportedProjectResponse } from "./sm-exported-project.response";
import { SecretsManagerExportedSecretResponse } from "./sm-exported-secret.response";

export class SecretsManagerExportResponse extends BaseResponse {
  projects: SecretsManagerExportedProjectResponse[];
  secrets: SecretsManagerExportedSecretResponse[];

  constructor(response: any) {
    super(response);

    const projects = this.getResponseProperty("Projects");
    const secrets = this.getResponseProperty("Secrets");

    this.projects = projects?.map((k: any) => new SecretsManagerExportedProjectResponse(k));
    this.secrets = secrets?.map((k: any) => new SecretsManagerExportedSecretResponse(k));
  }
}
