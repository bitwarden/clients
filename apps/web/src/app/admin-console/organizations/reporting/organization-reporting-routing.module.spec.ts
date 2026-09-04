import { EnvironmentInjector, runInInjectionContext } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  convertToParamMap,
  provideRouter,
  Route,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService, ToastService } from "@bitwarden/components";

import {
  canAccessMemberAdoptionReport,
  OrganizationReportingRoutingModule,
} from "./organization-reporting-routing.module";

const organizationId = "6a3b4c2d-0000-4000-8000-1c9e5f7a2b31";

const snapshotFor = (id: string) =>
  ({ params: { organizationId: id } }) as unknown as ActivatedRouteSnapshot;

const emptyState = () =>
  ({ root: { queryParamMap: convertToParamMap({}) } }) as unknown as RouterStateSnapshot;

describe("canAccessMemberAdoptionReport", () => {
  let configService: MockProxy<ConfigService>;
  let logService: MockProxy<LogService>;
  let injector: EnvironmentInjector;
  let router: Router;

  beforeEach(() => {
    configService = mock<ConfigService>();
    logService = mock<LogService>();

    TestBed.configureTestingModule({
      providers: [
        { provide: ConfigService, useValue: configService },
        { provide: LogService, useValue: logService },
        provideRouter([]),
      ],
    });

    injector = TestBed.inject(EnvironmentInjector);
    router = TestBed.inject(Router);
  });

  const run = () =>
    runInInjectionContext(injector, () =>
      canAccessMemberAdoptionReport()(snapshotFor(organizationId), emptyState()),
    );

  it("activates the route when the feature flag is on", async () => {
    configService.getFeatureFlag.mockResolvedValue(true);

    await expect(run()).resolves.toBe(true);
    expect(configService.getFeatureFlag).toHaveBeenCalledWith(FeatureFlag.MemberAdoptionReport);
  });

  it("redirects to the organization reports page when the feature flag is off", async () => {
    configService.getFeatureFlag.mockResolvedValue(false);

    const result = await run();

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe(
      `/organizations/${organizationId}/reporting/reports`,
    );
  });

  it("does not redirect to the individual vault reports page", async () => {
    configService.getFeatureFlag.mockResolvedValue(false);

    const result = await run();

    expect(router.serializeUrl(result as UrlTree)).not.toBe("/reports");
  });

  it("fails closed to the organization reports page when the flag cannot be read", async () => {
    const error = new Error("config unavailable");
    configService.getFeatureFlag.mockRejectedValue(error);

    const result = await run();

    expect(router.serializeUrl(result as UrlTree)).toBe(
      `/organizations/${organizationId}/reporting/reports`,
    );
    expect(logService.error).toHaveBeenCalledWith(error);
  });
});

describe("member adoption report route", () => {
  let configService: MockProxy<ConfigService>;
  let dialogService: MockProxy<DialogService>;
  let organizationService: MockProxy<OrganizationService>;
  let syncService: MockProxy<SyncService>;
  let injector: EnvironmentInjector;
  let router: Router;
  let route: Route;

  const userId = Utils.newGuid() as UserId;

  const orgFactory = (props: Partial<Organization> = {}) =>
    Object.assign(
      new Organization(),
      {
        id: organizationId,
        enabled: true,
        type: OrganizationUserType.Admin,
        permissions: new PermissionsApi(),
        productTierType: ProductTierType.Enterprise,
        useEvents: true,
      },
      props,
    ) as Organization;

  /** A custom role holding accessEventLogs but not accessReports: it clears the reporting tab but not this report. */
  const eventLogsOnlyMember = (props: Partial<Organization> = {}) =>
    orgFactory({
      type: OrganizationUserType.Custom,
      permissions: Object.assign(new PermissionsApi(), {
        accessEventLogs: true,
        accessReports: false,
      }),
      ...props,
    });

  beforeEach(() => {
    configService = mock<ConfigService>();
    dialogService = mock<DialogService>();
    organizationService = mock<OrganizationService>();
    syncService = mock<SyncService>();
    syncService.getLastSync.mockResolvedValue(new Date());

    TestBed.configureTestingModule({
      imports: [OrganizationReportingRoutingModule],
      providers: [
        { provide: ConfigService, useValue: configService },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: DialogService, useValue: dialogService },
        { provide: OrganizationService, useValue: organizationService },
        { provide: AccountService, useValue: mockAccountServiceWith(userId) },
        { provide: SyncService, useValue: syncService },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: I18nService, useValue: mock<I18nService>() },
        provideRouter([]),
      ],
    });

    injector = TestBed.inject(EnvironmentInjector);
    router = TestBed.inject(Router);

    const findRoute = (routes: Route[]): Route | undefined => {
      for (const candidate of routes) {
        if (candidate.path === "member-adoption-report") {
          return candidate;
        }
        const child = candidate.children == null ? undefined : findRoute(candidate.children);
        if (child != null) {
          return child;
        }
      }
      return undefined;
    };

    route = findRoute(router.config) as Route;
  });

  /**
   * Runs the route's registered guards in order, stopping at the first one that does not return
   * true, the way the router composes them. Returns that guard's result, or true if all pass.
   */
  const activate = async (organization: Organization) => {
    organizationService.organizations$.mockReturnValue(of([organization]));

    for (const guard of (route.canActivate ?? []) as CanActivateFn[]) {
      const result = await runInInjectionContext(injector, () =>
        guard(snapshotFor(organizationId), emptyState()),
      );
      if (result !== true) {
        return result;
      }
    }

    return true;
  };

  it("is registered under the path its sibling reports use", () => {
    expect(route).toBeDefined();
  });

  it("activates for a member with report access when the feature flag is on", async () => {
    configService.getFeatureFlag.mockResolvedValue(true);

    await expect(activate(orgFactory())).resolves.toBe(true);
  });

  it("blocks members without report access before reading the feature flag", async () => {
    configService.getFeatureFlag.mockResolvedValue(true);

    const result = await activate(eventLogsOnlyMember());

    expect(router.serializeUrl(result as UrlTree)).toBe(`/organizations/${organizationId}`);
    expect(configService.getFeatureFlag).not.toHaveBeenCalled();
  });

  it("does not disclose the product tier to members without report access", async () => {
    configService.getFeatureFlag.mockResolvedValue(true);

    const result = await activate(eventLogsOnlyMember({ productTierType: ProductTierType.Teams }));

    expect(result).not.toBe(true);
    expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
  });

  it("redirects a permitted member to the organization reports page when the flag is off", async () => {
    configService.getFeatureFlag.mockResolvedValue(false);

    const result = await activate(orgFactory());

    expect(router.serializeUrl(result as UrlTree)).toBe(
      `/organizations/${organizationId}/reporting/reports`,
    );
  });

  it("evaluates the feature flag before the product tier guard", async () => {
    configService.getFeatureFlag.mockResolvedValue(false);

    const result = await activate(orgFactory({ productTierType: ProductTierType.Teams }));

    expect(router.serializeUrl(result as UrlTree)).toBe(
      `/organizations/${organizationId}/reporting/reports`,
    );
    expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
  });
});
