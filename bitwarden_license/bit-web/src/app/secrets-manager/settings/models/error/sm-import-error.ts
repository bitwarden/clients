// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SecretsManagerImportErrorLine } from "./sm-import-error-line";

export class SecretsManagerImportError extends Error {
  constructor(message?: string) {
    super(message);
  }

  lines: SecretsManagerImportErrorLine[];
}
