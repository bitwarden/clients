import { pamTestOrganization } from "@bitwarden/bit-common/pam/shared/testing/pam-test-helpers";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";

import {
  checkAnyOrganizationRequirement,
  checkOrganizationRequirement,
  PAM_NOT_A_MEMBER_MESSAGE,
  PamOrganizationRequirement,
} from "./organization-requirements";

const permissions = (overrides: Partial<PermissionsApi>) =>
  Object.assign(new PermissionsApi(), overrides);

describe("checkOrganizationRequirement", () => {
  it("refuses an organization the caller is not in", () => {
    expect(checkOrganizationRequirement(undefined, PamOrganizationRequirement.UsePam)).toBe(
      PAM_NOT_A_MEMBER_MESSAGE,
    );
  });

  it("refuses a provider user before anything else", () => {
    const organization = pamTestOrganization({ isProviderUser: true });

    expect(checkOrganizationRequirement(organization, PamOrganizationRequirement.UsePam)).toBe(
      "Privileged Controls is not available to provider users.",
    );
  });

  it("refuses an organization that does not use PAM, whatever the requirement", () => {
    const organization = pamTestOrganization({ usePam: false, type: OrganizationUserType.Owner });

    expect(
      checkOrganizationRequirement(organization, PamOrganizationRequirement.ManageAccessRules),
    ).toBe("This organization does not use Privileged Controls.");
  });

  it("passes the baseline for a member with no seat or admin rights", () => {
    const organization = pamTestOrganization({ accessPam: false });

    expect(
      checkOrganizationRequirement(organization, PamOrganizationRequirement.UsePam),
    ).toBeUndefined();
  });

  describe("AccessPam", () => {
    it("passes a seated member", () => {
      expect(
        checkOrganizationRequirement(pamTestOrganization(), PamOrganizationRequirement.AccessPam),
      ).toBeUndefined();
    });

    it("refuses an admin without a seat, who can manage PAM but not use it", () => {
      const organization = pamTestOrganization({
        type: OrganizationUserType.Admin,
        accessPam: false,
      });

      expect(
        checkOrganizationRequirement(organization, PamOrganizationRequirement.AccessPam),
      ).toContain("seat");
    });
  });

  describe("ManageAccessRules", () => {
    it("passes an admin", () => {
      const organization = pamTestOrganization({ type: OrganizationUserType.Admin });

      expect(
        checkOrganizationRequirement(organization, PamOrganizationRequirement.ManageAccessRules),
      ).toBeUndefined();
    });

    it("passes a custom user with the permission", () => {
      const organization = pamTestOrganization({
        type: OrganizationUserType.Custom,
        permissions: permissions({ manageAccessRules: true }),
      });

      expect(
        checkOrganizationRequirement(organization, PamOrganizationRequirement.ManageAccessRules),
      ).toBeUndefined();
    });

    it("refuses a plain member", () => {
      expect(
        checkOrganizationRequirement(
          pamTestOrganization(),
          PamOrganizationRequirement.ManageAccessRules,
        ),
      ).toContain("manage access rules");
    });
  });

  describe("ManageRotation", () => {
    it("passes a custom user with the permission", () => {
      const organization = pamTestOrganization({
        type: OrganizationUserType.Custom,
        permissions: permissions({ manageRotation: true }),
      });

      expect(
        checkOrganizationRequirement(organization, PamOrganizationRequirement.ManageRotation),
      ).toBeUndefined();
    });

    it("refuses an access-rules manager, a different permission", () => {
      const organization = pamTestOrganization({
        type: OrganizationUserType.Custom,
        permissions: permissions({ manageAccessRules: true }),
      });

      expect(
        checkOrganizationRequirement(organization, PamOrganizationRequirement.ManageRotation),
      ).toContain("credential rotation");
    });
  });
});

describe("checkAnyOrganizationRequirement", () => {
  it("passes when one organization satisfies the requirement", () => {
    const organizations = [
      pamTestOrganization({ accessPam: false }),
      pamTestOrganization({ accessPam: true }),
    ];

    expect(
      checkAnyOrganizationRequirement(organizations, PamOrganizationRequirement.AccessPam),
    ).toBeUndefined();
  });

  it("says no organization uses PAM when none does", () => {
    expect(
      checkAnyOrganizationRequirement(
        [pamTestOrganization({ usePam: false })],
        PamOrganizationRequirement.AccessPam,
      ),
    ).toBe("None of your organizations use Privileged Controls.");
    expect(checkAnyOrganizationRequirement([], PamOrganizationRequirement.UsePam)).toBe(
      "None of your organizations use Privileged Controls.",
    );
  });

  it("gives the requirement's refusal when the organizations use PAM but none qualifies", () => {
    expect(
      checkAnyOrganizationRequirement(
        [pamTestOrganization({ accessPam: false })],
        PamOrganizationRequirement.AccessPam,
      ),
    ).toContain("seat");
  });

  it("ignores provider-user organizations when naming the refusal", () => {
    expect(
      checkAnyOrganizationRequirement(
        [pamTestOrganization({ isProviderUser: true })],
        PamOrganizationRequirement.UsePam,
      ),
    ).toBe("None of your organizations use Privileged Controls.");
  });
});
