import { mock } from "jest-mock-extended";

import { ApprovalsService } from "@bitwarden/bit-common/pam/approvals";
import { PamInputError } from "@bitwarden/bit-common/pam/shared";
import { PAM_TEST_USER_ID } from "@bitwarden/bit-common/pam/shared/testing/pam-test-helpers";

import {
  decideRequest,
  readComment,
  revokeLease,
  SETTLED_MESSAGES,
  withdrawRequest,
} from "./approval-actions";

const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function conflict(message: string) {
  const e = new Error(`error in response: status code 409: {"message":"${message}"}`) as Error & {
    variant: string;
  };
  e.name = "ApprovalError";
  e.variant = "Api";
  return e;
}

describe("approval actions", () => {
  const service = mock<ApprovalsService>();

  beforeEach(() => jest.resetAllMocks());

  describe("readComment", () => {
    it.each([undefined, "", "   "])("refuses a deny comment of %p", async (comment) => {
      await expect(readComment(comment, "deny")).rejects.toThrow(PamInputError);
    });

    it("trims a deny comment", async () => {
      expect(await readComment("  why  ", "deny")).toBe("why");
    });

    it("treats an approve comment as optional", async () => {
      expect(await readComment(undefined, "approve")).toBeUndefined();
      expect(await readComment("  ", "approve")).toBeUndefined();
    });
  });

  it("does not call the service when a deny has no comment", async () => {
    await expect(decideRequest(service, PAM_TEST_USER_ID, ID, "deny", " ")).rejects.toThrow(
      PamInputError,
    );
    expect(service.decide).not.toHaveBeenCalled();
  });

  it("prints only id, status, resolvedAt and verdict for a decision", async () => {
    service.decide.mockResolvedValue({
      id: ID,
      status: "approved",
      resolvedAt: "2026-06-01T12:00:00Z",
      verdict: "approve",
    });
    const response = await decideRequest(service, PAM_TEST_USER_ID, ID, "approve", "ok");
    expect(response.success).toBe(true);
    expect(Object.keys(response.data as object).sort()).toEqual(
      ["id", "object", "resolvedAt", "status", "verdict"].sort(),
    );
  });

  it("answers an already-resolved conflict with a non-fatal notice", async () => {
    service.decide.mockRejectedValue(conflict("This request has already been resolved."));
    const response = await decideRequest(service, PAM_TEST_USER_ID, ID, "approve", undefined);
    expect(response.success).toBe(true);
    expect((response.data as unknown as { message: string }).message).toBe(
      SETTLED_MESSAGES["already-resolved"],
    );
  });

  it("rethrows an unrelated failure", async () => {
    service.decide.mockRejectedValue(new Error("boom"));
    await expect(
      decideRequest(service, PAM_TEST_USER_ID, ID, "approve", undefined),
    ).rejects.toThrow("boom");
  });

  it("says a withdrawal is recorded as a denial", async () => {
    service.withdraw.mockResolvedValue(undefined);
    const response = await withdrawRequest(service, PAM_TEST_USER_ID, ID);
    expect((response.data as unknown as { message: string }).message).toContain("denial");
  });

  it("treats a window that ended during a withdrawal as non-fatal", async () => {
    service.withdraw.mockRejectedValue(conflict("This request's window has already ended."));
    const response = await withdrawRequest(service, PAM_TEST_USER_ID, ID);
    expect(response.success).toBe(true);
    expect((response.data as unknown as { action: string }).action).toBe("window-ended");
  });

  it("passes the trimmed reason when ending a lease", async () => {
    service.revokeLease.mockResolvedValue(undefined);
    await revokeLease(service, PAM_TEST_USER_ID, ID, " done ");
    expect(service.revokeLease).toHaveBeenCalledWith(PAM_TEST_USER_ID, ID, "done");
  });
});
