// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SecretsManagerImportedProjectRequest } from "./sm-imported-project.request";
import { SecretsManagerImportedSecretRequest } from "./sm-imported-secret.request";

export class SecretsManagerImportRequest {
  projects: SecretsManagerImportedProjectRequest[];
  secrets: SecretsManagerImportedSecretRequest[];
}
