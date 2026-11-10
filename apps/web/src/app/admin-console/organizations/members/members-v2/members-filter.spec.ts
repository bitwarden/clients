import { OrganizationUserType, RevocationReasonType } from "@bitwarden/common/admin-console/enums";
import { OrganizationUserStatusType } from "@bitwarden/sdk-internal";

import { OrganizationUserView } from "../../core/views/organization-user.view";

import {
  AccountRecoveryFilter,
  matchesAccess,
  matchesPolicies,
  matchesProduct,
  matchesRole,
  matchesStatus,
  MemberProductFilter,
  PolicyOption,
  REVOCATION_REASON_OPTIONS,
  StatusOption,
  TwoFactorFilter,
} from "./members-filter";

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

  it("lists the revocation reasons in display order, with No reason recorded last", () => {
    expect(REVOCATION_REASON_OPTIONS).toEqual([
      { value: "revoked-1", labelKey: "revocationReasonByAdmin" },
      { value: "revoked-3", labelKey: "revocationReasonDeclinedItemTransfer" },
      { value: "revoked-4", labelKey: "revocationReasonSingleOrganizationNonCompliance" },
      { value: "revoked-2", labelKey: "revocationReasonTwoFactorNonCompliance" },
      { value: "revoked-0", labelKey: "revocationReasonNotRecorded" },
    ]);
  });

  it("offers a reason option for every revocation reason", () => {
    expect(REVOCATION_REASON_OPTIONS.map((option) => option.value).sort()).toEqual(
      Object.values(RevocationReasonType)
        .map((reason) => `revoked-${reason}`)
        .sort(),
    );
  });
});

describe("matchesRole", () => {
  const admin = { type: OrganizationUserType.Admin } as OrganizationUserView;

  it("matches everyone with nothing checked", () => {
    expect(matchesRole(admin)).toBe(true);
    expect(matchesRole(admin, [])).toBe(true);
  });

  it("matches only the checked roles", () => {
    expect(matchesRole(admin, [OrganizationUserType.Owner, OrganizationUserType.Admin])).toBe(true);
    expect(matchesRole(admin, [OrganizationUserType.User])).toBe(false);
  });
});

describe("matchesAccess", () => {
  const user = {
    groups: ["g-1"],
    collections: [{ id: "c-1" }],
  } as unknown as OrganizationUserView;

  it("matches everyone with nothing checked", () => {
    expect(matchesAccess(user, undefined, true)).toBe(true);
    expect(matchesAccess(user, [], false)).toBe(true);
  });

  it("matches on group IDs when the organization uses groups", () => {
    expect(matchesAccess(user, ["g-2", "g-1"], true)).toBe(true);
    expect(matchesAccess(user, ["c-1"], true)).toBe(false);
  });

  it("matches on collection IDs when the organization doesn't use groups", () => {
    expect(matchesAccess(user, ["c-1"], false)).toBe(true);
    expect(matchesAccess(user, ["g-1"], false)).toBe(false);
  });
});

describe("matchesProduct", () => {
  const sm = { accessSecretsManager: true, accessPam: false } as OrganizationUserView;
  const pam = { accessSecretsManager: false, accessPam: true } as OrganizationUserView;
  const none = { accessSecretsManager: false, accessPam: false } as OrganizationUserView;
  const both = [MemberProductFilter.SecretsManager, MemberProductFilter.PrivilegedControls];

  it("matches everyone with nothing checked", () => {
    expect(matchesProduct(none)).toBe(true);
    expect(matchesProduct(none, [])).toBe(true);
  });

  it("matches the checked product's access flag", () => {
    expect(matchesProduct(sm, [MemberProductFilter.SecretsManager])).toBe(true);
    expect(matchesProduct(pam, [MemberProductFilter.SecretsManager])).toBe(false);
    expect(matchesProduct(pam, [MemberProductFilter.PrivilegedControls])).toBe(true);
  });

  it("matches members with either product when both are checked", () => {
    expect(matchesProduct(sm, both)).toBe(true);
    expect(matchesProduct(pam, both)).toBe(true);
    expect(matchesProduct(none, both)).toBe(false);
  });
});

describe("matchesPolicies", () => {
  const user = (resetPasswordEnrolled: boolean, twoFactorEnabled: boolean) =>
    ({ resetPasswordEnrolled, twoFactorEnabled }) as OrganizationUserView;
  const enrolledActive = user(true, true);
  const enrolledInactive = user(true, false);
  const notEnrolledActive = user(false, true);
  const notEnrolledInactive = user(false, false);
  const all = [enrolledActive, enrolledInactive, notEnrolledActive, notEnrolledInactive];
  const matching = (policies?: PolicyOption[]) => all.filter((m) => matchesPolicies(m, policies));

  it("matches everyone with nothing checked", () => {
    expect(matching()).toEqual(all);
    expect(matching([])).toEqual(all);
  });

  it("matches on account recovery enrollment", () => {
    expect(matching([AccountRecoveryFilter.Enrolled])).toEqual([enrolledActive, enrolledInactive]);
    expect(matching([AccountRecoveryFilter.NotEnrolled])).toEqual([
      notEnrolledActive,
      notEnrolledInactive,
    ]);
  });

  it("matches on two-step login", () => {
    expect(matching([TwoFactorFilter.Active])).toEqual([enrolledActive, notEnrolledActive]);
    expect(matching([TwoFactorFilter.Inactive])).toEqual([enrolledInactive, notEnrolledInactive]);
  });

  it("doesn't narrow on a section with both options checked", () => {
    expect(matching([AccountRecoveryFilter.Enrolled, AccountRecoveryFilter.NotEnrolled])).toEqual(
      all,
    );
    expect(matching([TwoFactorFilter.Active, TwoFactorFilter.Inactive])).toEqual(all);
    expect(
      matching([
        AccountRecoveryFilter.Enrolled,
        AccountRecoveryFilter.NotEnrolled,
        TwoFactorFilter.Inactive,
      ]),
    ).toEqual([enrolledInactive, notEnrolledInactive]);
  });

  it("requires a match in both sections", () => {
    expect(matching([AccountRecoveryFilter.Enrolled, TwoFactorFilter.Inactive])).toEqual([
      enrolledInactive,
    ]);
  });
});
