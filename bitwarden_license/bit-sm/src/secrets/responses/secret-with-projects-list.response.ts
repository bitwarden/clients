import { BaseResponse } from "@bitwarden/common/models/response/base.response";

import { SecretListItemResponse } from "./secret-list-item.response";
import { SecretProjectResponse } from "./secret-project.response";

export class SecretWithProjectsListResponse extends BaseResponse {
  secrets: SecretListItemResponse[];
  projects: SecretProjectResponse[];

  constructor(response: any) {
    super(response);
    const secrets = this.getResponseProperty("secrets");
    const projects = this.getResponseProperty("projects");
    this.projects =
      projects == null ? null : projects.map((k: any) => new SecretProjectResponse(k));
    this.secrets = secrets == null ? [] : secrets.map((dr: any) => new SecretListItemResponse(dr));
  }
}
