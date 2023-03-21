import { Guid } from "@bitwarden/common/types/guid";

import { SecretProjectView } from "./secret-project.view";

export class SecretListView {
  id: Guid;
  organizationId: Guid;
  name: string;
  creationDate: string;
  revisionDate: string;
  projects: SecretProjectView[];
}
