// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { MockProxy, any, mock } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";

import { isEnterpriseOrgGuard } from "./is-enterprise-org.guard";

@Component({
  template: "<h1>This is the home screen!</h1>",
})
export class HomescreenComponent {}

@Component({
  template: "<h1>This component can only be accessed by a enterprise organization!</h1>",
})
export class IsEnterpriseOrganizationComponent {}

@Component({
  template: "<h1>This is the organization upgrade screen!</h1>",
})
export class OrganizationUpgradeScreenComponent {}

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

describe("Is Enterprise Org Guard", () => {
  let organizationService: MockProxy<OrganizationService>;
  let dialogService: MockProxy<DialogService>;
  let routerHarness: RouterTestingHarness;
  let accountService: FakeAccountService;
  const userId = Utils.newGuid() as UserId;

  beforeEach(async () => {
    organizationService = mock<OrganizationService>();
    dialogService = mock<DialogService>();
    accountService = mockAccountServiceWith(userId);

    TestBed.configureTestingModule({
      providers: [
        { provide: OrganizationService, useValue: organizationService },
        { provide: DialogService, useValue: dialogService },
        { provide: AccountService, useValue: accountService },
        provideRouter([
          {
            path: "",
            component: HomescreenComponent,
          },
          {
            path: "organizations/:organizationId/enterpriseOrgsOnly",
            component: IsEnterpriseOrganizationComponent,
            canActivate: [isEnterpriseOrgGuard(true)],
          },
          {
            path: "organizations/:organizationId/enterpriseOrgsOnlyNoError",
            component: IsEnterpriseOrganizationComponent,
            canActivate: [isEnterpriseOrgGuard(false)],
          },

          {
            path: "organizations/:organizationId/billing/subscription",
            component: OrganizationUpgradeScreenComponent,
          },
        ]),
      ],
    });

    routerHarness = await RouterTestingHarness.create();
  });

  it("redirects to `/` if the organization id provided is not found", async () => {
    const org = orgFactory();
    organizationService.organizations$.calledWith(userId).mockReturnValue(of([]));
    await routerHarness.navigateByUrl(`organizations/${org.id}/enterpriseOrgsOnly`);
    expect(routerHarness.routeNativeElement?.querySelector("h1")?.textContent?.trim() ?? "").toBe(
      "This is the home screen!",
    );
  });

  it.each([
    ProductTierType.Free,
    ProductTierType.Families,
    ProductTierType.Teams,
    ProductTierType.TeamsStarter,
  ])(
    "shows a dialog to users of a not enterprise organization and does not proceed with navigation for productTierType '%s'",
    async (productTierType) => {
      const org = orgFactory({
        type: OrganizationUserType.User,
        productTierType: productTierType,
      });
      organizationService.organizations$.calledWith(userId).mockReturnValue(of([org]));
      await routerHarness.navigateByUrl(`organizations/${org.id}/enterpriseOrgsOnly`);
      expect(dialogService.openSimpleDialog).toHaveBeenCalled();
      expect(
        routerHarness.routeNativeElement?.querySelector("h1")?.textContent?.trim() ?? "",
      ).not.toBe("This component can only be accessed by a enterprise organization!");
    },
  );

  it("redirects users with billing access to the billing screen to upgrade", async () => {
    const org = orgFactory({
      type: OrganizationUserType.Owner,
      productTierType: ProductTierType.Teams,
    });
    organizationService.organizations$.calledWith(userId).mockReturnValue(of([org]));
    dialogService.openSimpleDialog.calledWith(any()).mockResolvedValue(true);
    await routerHarness.navigateByUrl(`organizations/${org.id}/enterpriseOrgsOnly`);
    expect(routerHarness.routeNativeElement?.querySelector("h1")?.textContent?.trim() ?? "").toBe(
      "This is the organization upgrade screen!",
    );
  });

  it.each([
    ProductTierType.Free,
    ProductTierType.Families,
    ProductTierType.Teams,
    ProductTierType.TeamsStarter,
  ])("does not proceed with the navigation for productTierType '%s'", async (productTierType) => {
    const org = orgFactory({
      type: OrganizationUserType.User,
      productTierType: productTierType,
    });
    organizationService.organizations$.calledWith(userId).mockReturnValue(of([org]));
    await routerHarness.navigateByUrl(`organizations/${org.id}/enterpriseOrgsOnlyNoError`);
    expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
    expect(
      routerHarness.routeNativeElement?.querySelector("h1")?.textContent?.trim() ?? "",
    ).not.toBe("This component can only be accessed by a enterprise organization!");
  });

  it("proceeds with navigation if the organization in question is a enterprise organization", async () => {
    const org = orgFactory({ productTierType: ProductTierType.Enterprise });
    organizationService.organizations$.calledWith(userId).mockReturnValue(of([org]));
    await routerHarness.navigateByUrl(`organizations/${org.id}/enterpriseOrgsOnly`);
    expect(routerHarness.routeNativeElement?.querySelector("h1")?.textContent?.trim() ?? "").toBe(
      "This component can only be accessed by a enterprise organization!",
    );
  });
});
