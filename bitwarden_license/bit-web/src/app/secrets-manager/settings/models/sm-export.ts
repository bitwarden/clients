import { Guid } from "@bitwarden/common/types/guid";

export class SecretsManagerExport {
  projects: SecretsManagerExportProject[];
  secrets: SecretsManagerExportSecret[];
}

export class SecretsManagerExportProject {
  id: Guid;
  name: string;
}

export class SecretsManagerExportSecret {
  id: Guid;
  key: string;
  value: string;
  note: string;
  projectIds: Guid[];
}
