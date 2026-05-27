import { OrganizationUserBulkResponse } from "@bitwarden/admin-console/common";

export const REQUESTS_PER_BATCH = 500;

/**
 * A tagged union of either a
 * {@link MemberActionSuccess}
 * or
 * {@link MemberActionFailure}.
 * Use the "===" operator for narrowing.
 * ex: result.success === false
 */
export type MemberActionResult = MemberActionSuccess | MemberActionFailure;

export interface MemberActionSuccess {
  success: true;
}

export interface MemberActionFailure {
  success: false;
  error: string;
}

export class BulkActionResult {
  successful: OrganizationUserBulkResponse[] = [];
  failed: { id: string; error: string }[] = [];
}
