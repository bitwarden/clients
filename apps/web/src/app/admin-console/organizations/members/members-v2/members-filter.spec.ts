import { RevocationReasonType } from "@bitwarden/common/admin-console/enums";
import { OrganizationUserStatusType } from "@bitwarden/sdk-internal";

import { OrganizationUserView } from "../../core/views/organization-user.view";

import { matchesStatus, REVOCATION_REASON_OPTIONS, StatusOption } from "./members-filter";

function member(
  status: OrganizationUserStatusType,
  revocationReason?: RevocationReasonType,
): OrganizationUserView {
  return { status, revocationReason } as OrganizationUserView;
}

describe("matchesStatus", () => {
  const invited = member(OrganizationUserStatusType.Invited);
  const confirmed = member(OrganizationUserStatusType.Confirmed);
  const revokedByAdmin = member(OrganizationUserStatusType.Revoked, RevocationReasonType.Manual);
  const revokedNoReason = member(OrganizationUserStatusType.Revoked);

  it.each<[StatusOption[] | undefined]>([[undefined], [[]]])(
    "shows every member but revoked ones when %p is checked",
    (status) => {
      expect(matchesStatus(invited, status)).toBe(true);
      expect(matchesStatus(confirmed, status)).toBe(true);
      expect(matchesStatus(revokedByAdmin, status)).toBe(false);
    },
  );

  it("shows only members with a checked status", () => {
    const status: StatusOption[] = [OrganizationUserStatusType.Invited];

    expect(matchesStatus(invited, status)).toBe(true);
    expect(matchesStatus(confirmed, status)).toBe(false);
    expect(matchesStatus(revokedByAdmin, status)).toBe(false);
  });

  it("shows only revoked members whose reason is checked", () => {
    const status: StatusOption[] = ["revoked-1"];

    expect(matchesStatus(revokedByAdmin, status)).toBe(true);
    expect(matchesStatus(revokedNoReason, status)).toBe(false);
    expect(matchesStatus(invited, status)).toBe(false);
  });

  it("treats a revoked member without a reason as Unknown", () => {
    expect(matchesStatus(revokedNoReason, ["revoked-0"])).toBe(true);
  });

  it("shows every member, revoked included, when all five statuses are checked", () => {
    const status: StatusOption[] = [
      OrganizationUserStatusType.Staged,
      OrganizationUserStatusType.Invited,
      OrganizationUserStatusType.Accepted,
      OrganizationUserStatusType.Confirmed,
      OrganizationUserStatusType.Revoked,
      ...REVOCATION_REASON_OPTIONS.map((option) => option.value),
    ];

    expect(
      [invited, confirmed, revokedByAdmin, revokedNoReason].every((m) => matchesStatus(m, status)),
    ).toBe(true);
  });

  it("offers a reason option for every revocation reason", () => {
    expect(REVOCATION_REASON_OPTIONS.map((option) => option.value).sort()).toEqual(
      Object.values(RevocationReasonType)
        .map((reason) => `revoked-${reason}`)
        .sort(),
    );
  });
});
