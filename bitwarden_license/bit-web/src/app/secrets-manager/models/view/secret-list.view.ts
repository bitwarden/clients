// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SecretProjectView } from "./secret-project.view";

export class SecretListView {
  id: string;
  organizationId: string;
  name: string;
  creationDate: string;
  revisionDate: string;
  projects: SecretProjectView[];
  read: boolean;
  write: boolean;
}
