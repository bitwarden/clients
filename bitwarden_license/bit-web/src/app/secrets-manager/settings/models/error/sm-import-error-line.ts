// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
export class SecretsManagerImportErrorLine {
  id: number;
  type: "Project" | "Secret";
  key: string;
  errorMessage: string;
}
