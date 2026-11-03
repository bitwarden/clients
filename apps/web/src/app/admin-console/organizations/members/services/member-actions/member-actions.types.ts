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

interface MemberActionSuccess {
  success: true;
}

interface MemberActionFailure {
  success: false;
  error: string;
}

/** The outcome of a bulk member operation for one member. `error` is absent when it succeeded. */
export type OrganizationUserBulkResult = {
  id: string;
  error?: string;
};

export class BulkActionResult {
  successful: OrganizationUserBulkResult[] = [];
  failed: { id: string; error: string }[] = [];
}
