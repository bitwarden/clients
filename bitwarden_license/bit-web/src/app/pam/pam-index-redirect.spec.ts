import { ChangeDetectionStrategy, Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router, RouterOutlet, Routes, withRouterConfig } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { organizationRedirectGuard } from "@bitwarden/web-vault/app/admin-console/organizations/guards/org-redirect.guard";

import { pamLandingRoute } from "./pam-landing-route";

@Component({
  selector: "app-shell",
  template: "<router-outlet></router-outlet>",
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ShellComponent {}

@Component({
  selector: "app-blank",
  template: "blank",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class BlankComponent {}

/**
 * Mirrors the `OrganizationsRoutingModule` nesting with `PamRoutingModule`'s index route and
 * stubbed sections. Guards are left off, since only the index redirect is under test.
 */
const routes: Routes = [
  {
    path: "organizations/:organizationId",
    component: ShellComponent,
    children: [
      {
        path: "pam",
        children: [
          {
            path: "",
            pathMatch: "full",
            canActivate: [organizationRedirectGuard(pamLandingRoute)],
            children: [],
          },
          { path: "access-rules", component: BlankComponent },
          { path: "audit", component: BlankComponent },
          { path: "rotation", component: BlankComponent },
        ],
      },
      { path: "vault", component: BlankComponent },
    ],
  },
];

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

describe("the PAM index route", () => {
  async function navigate(organization: Organization): Promise<string> {
    TestBed.configureTestingModule({
      providers: [
        // Matches the root config, which the guard's organizationId read depends on.
        provideRouter(routes, withRouterConfig({ paramsInheritanceStrategy: "always" })),
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-id" }) } },
        { provide: OrganizationService, useValue: { organizations$: () => of([organization]) } },
      ],
    });

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl("/organizations/org-id/pam");

    return TestBed.inject(Router).url;
  }

  afterEach(() => TestBed.resetTestingModule());

  it("sends a rule author to the rules list", async () => {
    expect(await navigate(member({ manageAccessRules: true }))).toBe(
      "/organizations/org-id/pam/access-rules",
    );
  });

  it("sends a rotation admin to the rotation pages, not the rules list they cannot open", async () => {
    expect(await navigate(member({ manageRotation: true }))).toBe(
      "/organizations/org-id/pam/rotation",
    );
  });

  it("sends a member holding no PAM permission back out to the console", async () => {
    expect(await navigate(member({ manageUsers: true }))).toBe("/organizations/org-id");
  });
});
