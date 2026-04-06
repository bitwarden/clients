// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
export class SecretsManagerExport {
  projects: SecretsManagerExportProject[];
  secrets: SecretsManagerExportSecret[];
}

export class SecretsManagerExportProject {
  id: string;
  name: string;
}

export class SecretsManagerExportSecret {
  id: string;
  key: string;
  value: string;
  note: string;
  projectIds: string[];
}
