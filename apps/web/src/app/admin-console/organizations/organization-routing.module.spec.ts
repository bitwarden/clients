import { TestBed } from "@angular/core/testing";

import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

import { PAM_ORG_ADMIN_ROUTE } from "../../pam/pam-org-admin-route.token";

import { getOrganizationRoute } from "./organization-routing.module";

function org(props: Partial<Organization> = {}): Organization {
  return Object.assign(new Organization(), {
    id: "org-id",
    enabled: true,
    isMember: true,
    type: OrganizationUserType.Admin,
    permissions: new PermissionsApi(),
    ...props,
  });
}

/** A Custom member whose only authority in the organization is authoring access rules. */
function ruleAuthor(): Organization {
  return org({
    type: OrganizationUserType.Custom,
    usePam: true,
    permissions: Object.assign(new PermissionsApi(), { manageAccessRules: true }),
  });
}

/** A Custom member whose only authority is administering the rotation fleet. */
function rotationAdmin(): Organization {
  return org({
    type: OrganizationUserType.Custom,
    usePam: true,
    permissions: Object.assign(new PermissionsApi(), { manageRotation: true }),
  });
}

describe("getOrganizationRoute", () => {
  function route(organization: Organization, pamRoute?: string): string | undefined {
    TestBed.configureTestingModule({
      providers: pamRoute == null ? [] : [{ provide: PAM_ORG_ADMIN_ROUTE, useValue: pamRoute }],
    });

    return TestBed.runInInjectionContext(() => getOrganizationRoute(organization));
  }

  afterEach(() => TestBed.resetTestingModule());

  it("lands an admin on the vault, ahead of every other section", () => {
    expect(route(org({ usePam: true }), "pam")).toBe("vault");
  });

  it("lands a member who can only author access rules on the PAM pages", () => {
    expect(route(ruleAuthor(), "pam")).toBe("pam");
  });

  it("lands a member who can only administer rotation on the PAM pages", () => {
    expect(route(rotationAdmin(), "pam")).toBe("pam");
  });

  it("lands nobody on the PAM pages in a build that does not mount them", () => {
    expect(route(ruleAuthor())).toBeUndefined();
  });
});
