import { EncString } from "@bitwarden/sdk-internal";

// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore

export class SecretsManagerImportedSecretRequest {
  id: string;
  key: EncString;
  value: EncString;
  note: EncString;
  projectIds: string[];
}
