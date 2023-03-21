import { Guid } from "@bitwarden/common/types/guid";

import { SecretProjectView } from "./secret-project.view";

export class SecretView {
  id: Guid;
  organizationId: Guid;
  name: string;
  value: string;
  note: string;
  creationDate: string;
  revisionDate: string;
  projects: SecretProjectView[];
}
