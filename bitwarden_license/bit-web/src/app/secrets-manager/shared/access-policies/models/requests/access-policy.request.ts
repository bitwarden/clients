import { Guid } from "@bitwarden/common/types/guid";

export class AccessPolicyRequest {
  granteeId: Guid;
  read: boolean;
  write: boolean;
}
