import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { Guid } from "@bitwarden/common/types/guid";

import { SecretProjectResponse } from "./secret-project.response";

export class SecretResponse extends BaseResponse {
  id: Guid;
  organizationId: Guid;
  name: string;
  value: string;
  note: string;
  creationDate: string;
  revisionDate: string;
  projects: SecretProjectResponse[];

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.organizationId = this.getResponseProperty("OrganizationId");
    this.name = this.getResponseProperty("Key");
    this.value = this.getResponseProperty("Value");
    this.note = this.getResponseProperty("Note");
    this.creationDate = this.getResponseProperty("CreationDate");
    this.revisionDate = this.getResponseProperty("RevisionDate");

    const projects = this.getResponseProperty("Projects");
    this.projects =
      projects == null ? null : projects.map((k: any) => new SecretProjectResponse(k));
  }
}
