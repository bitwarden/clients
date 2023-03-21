import { EncString } from "@bitwarden/common/models/domain/enc-string";
import { Guid } from "@bitwarden/common/types/guid";

export class SecretsManagerImportedProjectRequest {
  id: Guid;
  name: EncString;
}
