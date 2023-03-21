import { EncString } from "@bitwarden/common/models/domain/enc-string";
import { Guid } from "@bitwarden/common/types/guid";

export class SecretsManagerImportedSecretRequest {
  id: Guid;
  key: EncString;
  value: EncString;
  note: EncString;
  projectIds: Guid[];
}
