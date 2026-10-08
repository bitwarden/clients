import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

import { pamLandingRoute } from "./pam-landing-route";

function member(permissions: Partial<PermissionsApi>): Organization {
  return Object.assign(new Organization(), {
    id: "org-id",
    enabled: true,
    isMember: true,
    usePam: true,
    useEvents: true,
    type: OrganizationUserType.Custom,
    permissions: Object.assign(new PermissionsApi(), permissions),
  });
}

describe("pamLandingRoute", () => {
  it("lands a rule author on the rules list", () => {
    expect(pamLandingRoute(member({ manageAccessRules: true }))).toBe("access-rules");
  });

  it("lands an auditor on the audit log", () => {
    expect(pamLandingRoute(member({ accessEventLogs: true }))).toBe("audit");
  });

  it("lands an auditor nowhere when the organization does not use PAM", () => {
    const auditor = member({ accessEventLogs: true });
    auditor.usePam = false;
    expect(pamLandingRoute(auditor)).toBeUndefined();
  });

  it("lands a rotation admin on the rotation pages", () => {
    expect(pamLandingRoute(member({ manageRotation: true }))).toBe("rotation");
  });

  it("prefers the rules list when a member holds more than one", () => {
    expect(pamLandingRoute(member({ manageAccessRules: true, manageRotation: true }))).toBe(
      "access-rules",
    );
  });

  it("lands a member holding none of the three nowhere", () => {
    expect(pamLandingRoute(member({}))).toBeUndefined();
  });
});
