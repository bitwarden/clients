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

/**
 * Fails every sent member the server returned no row for with `excludedMessage` ("Excluded, not
 * applicable for this action"), so each sent member is accounted for.
 */
export function failUnreported(
  sentIds: string[],
  result: BulkActionResult,
  excludedMessage: string,
): BulkActionResult {
  const reported = new Set([...result.successful, ...result.failed].map((row) => row.id));
  const excluded = sentIds
    .filter((id) => !reported.has(id))
    .map((id) => ({ id, error: excludedMessage }));
  if (excluded.length === 0) {
    return result;
  }
  return { successful: result.successful, failed: [...result.failed, ...excluded] };
}
