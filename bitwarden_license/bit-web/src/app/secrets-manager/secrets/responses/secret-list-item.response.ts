import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { Guid } from "@bitwarden/common/types/guid";

import { SecretProjectResponse } from "./secret-project.response";

export class SecretListItemResponse extends BaseResponse {
  id: Guid;
  organizationId: Guid;
  name: string;
  creationDate: string;
  revisionDate: string;
  projects: SecretProjectResponse[];

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.organizationId = this.getResponseProperty("OrganizationId");
    this.name = this.getResponseProperty("Key");
    this.creationDate = this.getResponseProperty("CreationDate");
    this.revisionDate = this.getResponseProperty("RevisionDate");

    const project = this.getResponseProperty("projects");
    this.projects = project == null ? null : project.map((k: any) => new SecretProjectResponse(k));
  }
}
