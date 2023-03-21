import { Guid } from "@bitwarden/common/types/guid";

export class RevokeAccessTokensRequest {
  ids: Guid[];
}
