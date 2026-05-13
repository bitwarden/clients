import { OrganizationUserBulkResponse } from "@bitwarden/admin-console/common";

export const REQUESTS_PER_BATCH = 500;

export type MemberActionResult = MemberActionSuccess | MemberActionFailure;

interface MemberActionSuccess {
  success: true;
}
interface MemberActionFailure {
  success: false;
  error: string;
}

export class BulkActionResult {
  successful: OrganizationUserBulkResponse[] = [];
  failed: { id: string; error: string }[] = [];
}
