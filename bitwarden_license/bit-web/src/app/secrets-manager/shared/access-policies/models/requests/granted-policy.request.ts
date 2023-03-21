import { Guid } from "@bitwarden/common/types/guid";

export class GrantedPolicyRequest {
  grantedId: Guid;
  read: boolean;
  write: boolean;
}
