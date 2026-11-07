import {
  SecretsManagerExport,
  SecretsManagerExportProject,
  SecretsManagerExportSecret,
} from "@bitwarden/bit-sm";
import { BaseResponse } from "@bitwarden/cli/models/response/base.response";

export class SmExportResponse implements BaseResponse {
  object = "sm-export";

  projects: SecretsManagerExportProject[];
  secrets: SecretsManagerExportSecret[];

  constructor(data: SecretsManagerExport) {
    this.projects = data.projects;
    this.secrets = data.secrets;
  }
}
