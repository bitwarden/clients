import {
  ApprovalsService,
  ApprovalSettledOutcome,
  settledOutcome,
  ApprovalVerdict,
} from "@bitwarden/bit-common/pam/approvals";
import { PamInputError } from "@bitwarden/bit-common/pam/shared";
import { Response } from "@bitwarden/cli/models/response";
import { UserId } from "@bitwarden/common/types/guid";

import { readReasonText } from "../shared";

import { ApprovalActionResponse, ApprovalDecisionResponse } from "./approval.response";

/** Shown for a request someone else resolved first, or whose window closed. Not a failure. */
export const SETTLED_MESSAGES: Record<ApprovalSettledOutcome, string> = {
  "already-resolved":
    "This request was already resolved (decided by another approver, withdrawn or retracted). Nothing changed.",
  "window-ended": "This request's window has already ended. Nothing changed.",
};

/**
 * The text of a decision comment, trimmed. A deny needs one that is not blank, checked here before
 * anything is sent; an approve's is optional, and a blank one counts as none. Never echoed.
 */
export async function readComment(
  comment: string | undefined,
  verdict: ApprovalVerdict,
): Promise<string | undefined> {
  const blank = comment == null || comment.trim().length === 0;
  if (blank && verdict === "deny") {
    throw new PamInputError("A comment is required to deny a request. Give it with --comment.");
  }
  return blank ? undefined : await readReasonText({ reason: comment }, { label: "comment" });
}

function settled(outcome: ApprovalSettledOutcome, id: string): Response {
  return Response.success(new ApprovalActionResponse(outcome, id, SETTLED_MESSAGES[outcome]));
}

/** Records a decision. Checks the comment locally before anything is sent. */
export async function decideRequest(
  service: ApprovalsService,
  userId: UserId,
  requestId: string,
  verdict: ApprovalVerdict,
  rawComment: string | undefined,
): Promise<Response> {
  const comment = await readComment(rawComment, verdict);
  try {
    return Response.success(
      new ApprovalDecisionResponse(await service.decide(userId, requestId, verdict, comment)),
    );
  } catch (e) {
    const outcome = settledOutcome(e);
    if (outcome != null) {
      return settled(outcome, requestId);
    }
    throw e;
  }
}

export async function withdrawRequest(
  service: ApprovalsService,
  userId: UserId,
  requestId: string,
): Promise<Response> {
  try {
    await service.withdraw(userId, requestId);
    return Response.success(
      new ApprovalActionResponse(
        "withdrawn",
        requestId,
        "The approval was withdrawn. The server records it as your denial, with no reason.",
      ),
    );
  } catch (e) {
    const outcome = settledOutcome(e);
    if (outcome != null) {
      return settled(outcome, requestId);
    }
    throw e;
  }
}

export async function revokeLease(
  service: ApprovalsService,
  userId: UserId,
  leaseId: string,
  rawReason: string | undefined,
): Promise<Response> {
  const reason = await readReasonText({ reason: rawReason }, { label: "reason" });
  await service.revokeLease(userId, leaseId, reason);
  return Response.success(
    new ApprovalActionResponse("lease-revoked", leaseId, "The lease was ended."),
  );
}
