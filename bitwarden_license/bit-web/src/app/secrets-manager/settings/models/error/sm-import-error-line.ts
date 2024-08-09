export class SecretsManagerImportErrorLine {
  id: number;
  type: "Project" | "Secret";
  key: string;
  errorMessage: string;
}
