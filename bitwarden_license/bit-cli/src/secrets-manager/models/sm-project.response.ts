import { ProjectListView } from "@bitwarden/bit-common/secrets-manager/models/view/project-list.view";
import { ProjectView } from "@bitwarden/bit-common/secrets-manager/models/view/project.view";
import { BaseResponse } from "@bitwarden/cli/models/response/base.response";

export class SmProjectResponse implements BaseResponse {
  object = "sm-project";

  id: string;
  organizationId: string;
  name: string;
  creationDate: string;
  revisionDate: string;
  read: boolean;
  write: boolean;
  decryptionError: boolean;

  constructor(project: ProjectView | ProjectListView) {
    this.id = project.id;
    this.organizationId = project.organizationId;
    this.name = project.name;
    this.creationDate = project.creationDate;
    this.revisionDate = project.revisionDate;
    this.read = project.read;
    this.write = project.write;
    this.decryptionError = project.decryptionError;
  }
}
