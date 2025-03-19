import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { MockProxy, mock } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { ToastService } from "@bitwarden/components";
import { RouterService } from "@bitwarden/web-vault/app/core";

import { ServiceAccountView } from "../../models/view/service-account.view";
import { ServiceAccountService } from "../service-account.service";

import { serviceAccountAccessGuard } from "./service-account-access.guard";

@Component({
  template: "",
})
export class GuardedRouteTestComponent {}

@Component({
  template: "",
})
export class RedirectTestComponent {}

describe("Service account Redirect Guard", () => {
  let organizationService: MockProxy<OrganizationService>;
  let routerService: MockProxy<RouterService>;
  let serviceAccountServiceMock: MockProxy<ServiceAccountService>;
  let i18nServiceMock: MockProxy<I18nService>;
  let toastService: MockProxy<ToastService>;
  let router: Router;
  let accountService: FakeAccountService;
  const userId = Utils.newGuid() as UserId;

  const smOrg1 = { id: "123", canAccessSecretsManager: true } as Organization;
  const serviceAccountView = {
    id: "123",
    organizationId: "123",
    name: "service-account-name",
  } as ServiceAccountView;

  beforeEach(async () => {
    organizationService = mock<OrganizationService>();
    routerService = mock<RouterService>();
    serviceAccountServiceMock = mock<ServiceAccountService>();
    i18nServiceMock = mock<I18nService>();
    toastService = mock<ToastService>();
    accountService = mockAccountServiceWith(userId);

    TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([
          {
            path: "sm/:organizationId/machine-accounts/:serviceAccountId",
            component: GuardedRouteTestComponent,
            canActivate: [serviceAccountAccessGuard],
          },
          {
            path: "sm",
            component: RedirectTestComponent,
          },
          {
            path: "sm/:organizationId/machine-accounts",
            component: RedirectTestComponent,
          },
        ]),
      ],
      providers: [
        { provide: OrganizationService, useValue: organizationService },
        { provide: AccountService, useValue: accountService },
        { provide: RouterService, useValue: routerService },
        { provide: ServiceAccountService, useValue: serviceAccountServiceMock },
        { provide: I18nService, useValue: i18nServiceMock },
        { provide: ToastService, useValue: toastService },
      ],
    });

    router = TestBed.inject(Router);
  });

  it("redirects to sm/{orgId}/machine-accounts/{serviceAccountId} if machine account exists", async () => {
    // Arrange
    organizationService.organizations$.mockReturnValue(of([smOrg1]));
    serviceAccountServiceMock.getByServiceAccountId.mockReturnValue(
      Promise.resolve(serviceAccountView),
    );

    // Act
    await router.navigateByUrl("sm/123/machine-accounts/123");

    // Assert
    expect(router.url).toBe("/sm/123/machine-accounts/123");
  });

  it("redirects to sm/machine-accounts if machine account does not exist", async () => {
    // Arrange
    organizationService.organizations$.mockReturnValue(of([smOrg1]));

    // Act
    await router.navigateByUrl("sm/123/machine-accounts/124");

    // Assert
    expect(router.url).toBe("/sm/123/machine-accounts");
  });

  it("redirects to sm/123/machine-accounts if exception occurs while looking for service account", async () => {
    // Arrange
    jest.spyOn(serviceAccountServiceMock, "getByServiceAccountId").mockImplementation(() => {
      throw new Error("Test error");
    });
    jest.spyOn(i18nServiceMock, "t").mockReturnValue("Service account not found");

    // Act
    await router.navigateByUrl("sm/123/machine-accounts/123");
    // Assert
    expect(toastService.showToast).toHaveBeenCalledWith({
      variant: "error",
      title: null,
      message: "Service account not found",
    });
    expect(router.url).toBe("/sm/123/machine-accounts");
  });
});
