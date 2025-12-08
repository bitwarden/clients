// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { TestBed } from "@angular/core/testing";
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { ProviderUserType } from "@bitwarden/common/admin-console/enums";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { ToastService } from "@bitwarden/components";
import { newGuid } from "@bitwarden/guid";

import { providerPermissionsGuard } from "./provider-permissions.guard";

const providerFactory = (props: Partial<Provider> = {}) =>
  Object.assign(
    new Provider(),
    {
      id: "myProviderId",
      enabled: true,
      type: ProviderUserType.ServiceUser,
    },
    props,
  );

describe("Provider Permissions Guard", () => {
  let providerService: MockProxy<ProviderService>;
  let accountService: MockProxy<AccountService>;
  let route: MockProxy<ActivatedRouteSnapshot>;
  let state: MockProxy<RouterStateSnapshot>;

  const mockUserId = newGuid() as UserId;

  beforeEach(() => {
    providerService = mock<ProviderService>();
    accountService = mock<AccountService>();

    accountService.activeAccount$ = of({
      id: mockUserId,
      email: "test@example.com",
      emailVerified: true,
      name: "Test User",
    });

    route = mock<ActivatedRouteSnapshot>({
      params: {
        providerId: providerFactory().id,
      },
      data: {
        providerPermissions: null,
      },
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: ProviderService, useValue: providerService },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: Router, useValue: mock<Router>() },
        { provide: AccountService, useValue: accountService },
      ],
    });
  });

  it("blocks navigation if provider does not exist", async () => {
    providerService.get$
      .calledWith(providerFactory().id, mockUserId)
      .mockReturnValue(of(undefined));

    const actual = await TestBed.runInInjectionContext(
      async () => await providerPermissionsGuard()(route, state),
    );

    expect(actual).not.toBe(true);
  });

  it("permits navigation if no permissions are specified", async () => {
    const provider = providerFactory();
    providerService.get$.calledWith(provider.id, mockUserId).mockReturnValue(of(provider));

    const actual = await TestBed.runInInjectionContext(
      async () => await providerPermissionsGuard()(route, state),
    );

    expect(actual).toBe(true);
  });

  it("permits navigation if the user has permissions", async () => {
    const permissionsCallback = jest.fn();
    permissionsCallback.mockImplementation((_provider) => true);

    const provider = providerFactory();
    providerService.get$.calledWith(provider.id, mockUserId).mockReturnValue(of(provider));

    const actual = await TestBed.runInInjectionContext(
      async () => await providerPermissionsGuard(permissionsCallback)(route, state),
    );

    expect(permissionsCallback).toHaveBeenCalled();
    expect(actual).toBe(true);
  });

  it("blocks navigation if the user does not have permissions", async () => {
    const permissionsCallback = jest.fn();
    permissionsCallback.mockImplementation((_org) => false);
    const provider = providerFactory();
    providerService.get$.calledWith(provider.id, mockUserId).mockReturnValue(of(provider));

    const actual = await TestBed.runInInjectionContext(
      async () => await providerPermissionsGuard(permissionsCallback)(route, state),
    );

    expect(permissionsCallback).toHaveBeenCalled();
    expect(actual).not.toBe(true);
  });

  describe("given a disabled organization", () => {
    it("blocks navigation if user is not an admin", async () => {
      const org = providerFactory({
        type: ProviderUserType.ServiceUser,
        enabled: false,
      });
      providerService.get$.calledWith(org.id, mockUserId).mockReturnValue(of(org));

      const actual = await TestBed.runInInjectionContext(
        async () => await providerPermissionsGuard()(route, state),
      );

      expect(actual).not.toBe(true);
    });

    it("permits navigation if user is an admin", async () => {
      const org = providerFactory({
        type: ProviderUserType.ProviderAdmin,
        enabled: false,
      });
      providerService.get$.calledWith(org.id, mockUserId).mockReturnValue(of(org));

      const actual = await TestBed.runInInjectionContext(
        async () => await providerPermissionsGuard()(route, state),
      );

      expect(actual).toBe(true);
    });
  });
});
