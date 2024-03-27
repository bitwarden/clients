import {
  ActivatedRouteSnapshot,
  convertToParamMap,
  Router,
  RouterStateSnapshot,
} from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";

import { OrganizationPermissionsGuard } from "./org-permissions.guard";

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

describe("Organization Permissions Guard", () => {
  let router: MockProxy<Router>;
  let organizationService: MockProxy<OrganizationService>;
  let state: MockProxy<RouterStateSnapshot>;
  let route: MockProxy<ActivatedRouteSnapshot>;

  let organizationPermissionsGuard: OrganizationPermissionsGuard;

  beforeEach(() => {
    router = mock<Router>();
    organizationService = mock<OrganizationService>();
    state = mock<RouterStateSnapshot>();
    route = mock<ActivatedRouteSnapshot>({
      params: {
        organizationId: orgFactory().id,
      },
      data: {
        organizationPermissions: null,
      },
    });

    organizationPermissionsGuard = new OrganizationPermissionsGuard(
      router,
      organizationService,
      mock<PlatformUtilsService>(),
      mock<I18nService>(),
      mock<SyncService>(),
    );
  });

  it("blocks navigation if organization does not exist", async () => {
    organizationService.get.mockReturnValue(null);

    const actual = await organizationPermissionsGuard.canActivate(route, state);

    expect(actual).not.toBe(true);
  });

  it("permits navigation if no permissions are specified", async () => {
    const org = orgFactory();
    organizationService.get.calledWith(org.id).mockResolvedValue(org);

    const actual = await organizationPermissionsGuard.canActivate(route, state);

    expect(actual).toBe(true);
  });

  it("permits navigation if the user has permissions", async () => {
    const permissionsCallback = jest.fn();
    permissionsCallback.mockImplementation((org) => true);
    route.data = {
      organizationPermissions: permissionsCallback,
    };

    const org = orgFactory();
    organizationService.get.calledWith(org.id).mockResolvedValue(org);

    const actual = await organizationPermissionsGuard.canActivate(route, state);

    expect(permissionsCallback).toHaveBeenCalled();
    expect(actual).toBe(true);
  });

  describe("if the user does not have permissions", () => {
    it("and there is no Item ID, block navigation", async () => {
      const permissionsCallback = jest.fn();
      permissionsCallback.mockImplementation((org) => false);
      route.data = {
        organizationPermissions: permissionsCallback,
      };

      state = mock<RouterStateSnapshot>({
        root: mock<ActivatedRouteSnapshot>({
          queryParamMap: convertToParamMap({}),
        }),
      });

      const org = orgFactory();
      organizationService.get.calledWith(org.id).mockResolvedValue(org);

      const actual = await organizationPermissionsGuard.canActivate(route, state);

      expect(permissionsCallback).toHaveBeenCalled();
      expect(actual).not.toBe(true);
    });

    it("and there is an Item ID, redirect to the item in the individual vault", async () => {
      route.data = {
        organizationPermissions: (org: Organization) => false,
      };
      state = mock<RouterStateSnapshot>({
        root: mock<ActivatedRouteSnapshot>({
          queryParamMap: convertToParamMap({
            itemId: "myItemId",
          }),
        }),
      });
      const org = orgFactory();
      organizationService.get.calledWith(org.id).mockResolvedValue(org);

      const actual = await organizationPermissionsGuard.canActivate(route, state);

      expect(router.createUrlTree).toHaveBeenCalledWith(["/vault"], {
        queryParams: { itemId: "myItemId" },
      });
      expect(actual).not.toBe(true);
    });
  });

  describe("given a disabled organization", () => {
    it("blocks navigation if user is not an owner", async () => {
      const org = orgFactory({
        type: OrganizationUserType.Admin,
        enabled: false,
      });
      organizationService.get.calledWith(org.id).mockResolvedValue(org);

      const actual = await organizationPermissionsGuard.canActivate(route, state);

      expect(actual).not.toBe(true);
    });

    it("permits navigation if user is an owner", async () => {
      const org = orgFactory({
        type: OrganizationUserType.Owner,
        enabled: false,
      });
      organizationService.get.calledWith(org.id).mockResolvedValue(org);

      const actual = await organizationPermissionsGuard.canActivate(route, state);

      expect(actual).toBe(true);
    });
  });
});
