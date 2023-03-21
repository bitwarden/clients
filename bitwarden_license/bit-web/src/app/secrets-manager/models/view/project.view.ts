import { Guid } from "@bitwarden/common/types/guid";

export class ProjectView {
  id: Guid;
  organizationId: Guid;
  name: string;
  creationDate: string;
  revisionDate: string;
}

export class ProjectPermissionDetailsView extends ProjectView {
  read: boolean;
  write: boolean;
}
