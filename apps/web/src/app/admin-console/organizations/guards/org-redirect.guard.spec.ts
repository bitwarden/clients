import { ChangeDetectionStrategy, Component, inject, InjectionToken } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { MockProxy, mock } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { organizationRedirectGuard } from "./org-redirect.guard";

@Component({
  template: "<h1>This is the home screen!</h1>",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomescreenComponent {}

@Component({
  template: "<h1>This is the admin console!</h1>",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminConsoleComponent {}

@Component({
  template: "<h1> This is a subroute of the admin console!</h1>",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminConsoleSubrouteComponent {}

/** Placeholder for the optional seam tokens a real redirect callback reads. */
const REDIRECT_SEAM = new InjectionToken<string>("RedirectSeam");

const orgFactory = (props: Partial<Organization> = {}) =>
  Object.assign(
    new Organization(),
    {
      id: "myOrgId",
      enabled: true,
      type: OrganizationUserType.Admin,
    },
    props,
  );

describe("Organization Redirect Guard", () => {
  let organizationService: MockProxy<OrganizationService>;
  let routerHarness: RouterTestingHarness;
  let accountService: FakeAccountService;
  const userId = Utils.newGuid() as UserId;

  beforeEach(async () => {
    organizationService = mock<OrganizationService>();
    accountService = mockAccountServiceWith(userId);

    TestBed.configureTestingModule({
      imports: [HomescreenComponent, AdminConsoleComponent, AdminConsoleSubrouteComponent],
      providers: [
        { provide: OrganizationService, useValue: organizationService },
        { provide: AccountService, useValue: accountService },
        { provide: REDIRECT_SEAM, useValue: "success" },
        provideRouter([
          {
            path: "",
            component: HomescreenComponent,
          },
          {
            path: "organizations/:organizationId",
            component: AdminConsoleComponent,
          },
          {
            path: "organizations/:organizationId/stringCallback/success",
            component: AdminConsoleSubrouteComponent,
          },
          {
            path: "organizations/:organizationId/arrayCallback/exponential/success",
            component: AdminConsoleSubrouteComponent,
          },
          {
            path: "organizations/:organizationId/noCallback",
            component: AdminConsoleComponent,
            canActivate: [organizationRedirectGuard()],
          },
          {
            path: "organizations/:organizationId/stringCallback",
            component: AdminConsoleComponent,
            canActivate: [organizationRedirectGuard(() => "success")],
          },
          {
            path: "organizations/:organizationId/arrayCallback",
            component: AdminConsoleComponent,
            canActivate: [organizationRedirectGuard(() => ["exponential", "success"])],
          },
          {
            path: "organizations/:organizationId/undefinedCallback",
            component: AdminConsoleComponent,
            canActivate: [organizationRedirectGuard(() => undefined)],
          },
          {
            path: "organizations/:organizationId/injectingCallback/success",
            component: AdminConsoleSubrouteComponent,
          },
          {
            path: "organizations/:organizationId/injectingCallback",
            component: AdminConsoleComponent,
            canActivate: [
              organizationRedirectGuard(
                () => inject(REDIRECT_SEAM, { optional: true }) ?? undefined,
              ),
            ],
          },
        ]),
      ],
    });

    routerHarness = await RouterTestingHarness.create();
  });

  it("redirects to `/` if the organization id provided is not found", async () => {
    const org = orgFactory();
    organizationService.organizations$.calledWith(userId).mockReturnValue(of([]));
    await routerHarness.navigateByUrl(`organizations/${org.id}/noCallback`);
    expect(routerHarness.routeNativeElement?.querySelector("h1")?.textContent?.trim() ?? "").toBe(
      "This is the home screen!",
    );
  });

  it("redirects to `/organizations/{id}` if no custom redirect is supplied but the user can access the admin console", async () => {
    const org = orgFactory();
    organizationService.organizations$.calledWith(userId).mockReturnValue(of([org]));
    await routerHarness.navigateByUrl(`organizations/${org.id}/noCallback`);
    expect(routerHarness.routeNativeElement?.querySelector("h1")?.textContent?.trim() ?? "").toBe(
      "This is the admin console!",
    );
  });

  it("redirects properly when the redirect callback returns a single string", async () => {
    const org = orgFactory();
    organizationService.organizations$.calledWith(userId).mockReturnValue(of([org]));
    await routerHarness.navigateByUrl(`organizations/${org.id}/stringCallback`);
    expect(routerHarness.routeNativeElement?.querySelector("h1")?.textContent?.trim() ?? "").toBe(
      "This is a subroute of the admin console!",
    );
  });

  it("redirects properly when the redirect callback returns an array of strings", async () => {
    const org = orgFactory();
    organizationService.organizations$.calledWith(userId).mockReturnValue(of([org]));
    await routerHarness.navigateByUrl(`organizations/${org.id}/arrayCallback`);
    expect(routerHarness.routeNativeElement?.querySelector("h1")?.textContent?.trim() ?? "").toBe(
      "This is a subroute of the admin console!",
    );
  });

  it("runs the redirect callback in an injection context", async () => {
    const org = orgFactory();
    organizationService.organizations$.calledWith(userId).mockReturnValue(of([org]));
    await routerHarness.navigateByUrl(`organizations/${org.id}/injectingCallback`);
    expect(routerHarness.routeNativeElement?.querySelector("h1")?.textContent?.trim() ?? "").toBe(
      "This is a subroute of the admin console!",
    );
  });

  it("falls back to the admin console redirect when the redirect callback returns undefined", async () => {
    const org = orgFactory();
    organizationService.organizations$.calledWith(userId).mockReturnValue(of([org]));
    await routerHarness.navigateByUrl(`organizations/${org.id}/undefinedCallback`);
    expect(routerHarness.routeNativeElement?.querySelector("h1")?.textContent?.trim() ?? "").toBe(
      "This is the admin console!",
    );
  });
});

describe("Organization Redirect Guard on the organization root", () => {
  it("redirects to `/` rather than to itself when the redirect callback returns undefined", async () => {
    const org = orgFactory();
    const organizationService = mock<OrganizationService>();
    organizationService.organizations$.mockReturnValue(of([org]));
    let visits = 0;

    TestBed.configureTestingModule({
      imports: [HomescreenComponent, AdminConsoleComponent],
      providers: [
        { provide: OrganizationService, useValue: organizationService },
        { provide: AccountService, useValue: mockAccountServiceWith(Utils.newGuid() as UserId) },
        provideRouter([
          {
            path: "",
            component: HomescreenComponent,
          },
          {
            path: "organizations/:organizationId",
            component: AdminConsoleComponent,
            // The counter stops the redirect loop a regression would cause, which would otherwise
            // hang the test rather than fail it.
            canActivate: [() => ++visits <= 2, organizationRedirectGuard(() => undefined)],
          },
        ]),
      ],
    });
    const routerHarness = await RouterTestingHarness.create();

    await routerHarness.navigateByUrl(`organizations/${org.id}`);

    expect(routerHarness.routeNativeElement?.querySelector("h1")?.textContent?.trim() ?? "").toBe(
      "This is the home screen!",
    );
    expect(visits).toBe(1);
  });
});
