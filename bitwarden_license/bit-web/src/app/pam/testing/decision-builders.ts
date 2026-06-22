import { AccessDeciderKind, AccessDecisionVerdict, Decision } from "@bitwarden/bit-pam";

/**
 * Build a human {@link Decision} for unit tests that exercise decider resolution
 * (`resolveApprover` / `resolveResolver`). An automatic decision is represented in those tests by
 * passing no human decision (`undefined`), so only the human builder is needed here.
 */
export function humanDecision(init: {
  id: string;
  name?: string | null;
  email?: string | null;
}): Decision {
  return new Decision({
    DeciderKind: AccessDeciderKind.Human,
    Id: init.id,
    Name: init.name ?? null,
    Email: init.email ?? null,
    Comment: null,
    Verdict: AccessDecisionVerdict.Approve,
    DecidedAt: "2026-06-10T10:30:00Z",
  });
}
