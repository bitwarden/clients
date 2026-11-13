import {
  ApproverPrivilegeService,
  NOT_AN_APPROVER_MESSAGE,
} from "@bitwarden/bit-common/pam/approvals";
import { Response } from "@bitwarden/cli/models/response";
import { UserId } from "@bitwarden/common/types/guid";

import { ServiceContainer } from "../../service-container";

/**
 * Follows the web, which hides Approvals from anyone who is not an approver: refuses a
 * non-approver up front, before any SDK call, instead of letting the server answer with an empty
 * inbox or a confusing "not found". Evaluated across all of the user's organizations. Returns the
 * refusal, or `undefined` when the user is an approver.
 */
export async function refuseNonApprover(
  container: ServiceContainer,
  userId: UserId,
): Promise<Response | undefined> {
  const privileges = new ApproverPrivilegeService(
    container.organizationService,
    container.collectionService,
    container.accountService,
  );
  return (await privileges.canApprove(userId))
    ? undefined
    : Response.error(NOT_AN_APPROVER_MESSAGE);
}
