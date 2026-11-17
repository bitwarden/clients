import { BaseResponse } from "@bitwarden/common/models/response/base.response";

import { SecretProjectResponse } from "./secret-project.response";

export class SecretListItemResponse extends BaseResponse {
  id: string;
  organizationId: string;
  name: string;
  creationDate: string;
  revisionDate: string;
  projects: SecretProjectResponse[];
  read: boolean;
  write: boolean;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.organizationId = this.getResponseProperty("OrganizationId");
    this.name = this.getResponseProperty("Key");
    this.creationDate = this.getResponseProperty("CreationDate");
    this.revisionDate = this.getResponseProperty("RevisionDate");
    this.read = this.getResponseProperty("Read");
    this.write = this.getResponseProperty("Write");

    const project = this.getResponseProperty("projects");
    this.projects = project == null ? null : project.map((k: any) => new SecretProjectResponse(k));
  }
}
