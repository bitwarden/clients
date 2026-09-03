import { EnvironmentInjector, runInInjectionContext } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  provideRouter,
  Route,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService } from "@bitwarden/components";

import {
  canAccessMemberAdoptionReport,
  OrganizationReportingRoutingModule,
} from "./organization-reporting-routing.module";

const organizationId = "6a3b4c2d-0000-4000-8000-1c9e5f7a2b31";

const snapshotFor = (id: string) =>
  ({ params: { organizationId: id } }) as unknown as ActivatedRouteSnapshot;

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
      canAccessMemberAdoptionReport()(snapshotFor(organizationId), {} as RouterStateSnapshot),
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
  let injector: EnvironmentInjector;
  let route: Route;

  beforeEach(() => {
    configService = mock<ConfigService>();
    dialogService = mock<DialogService>();

    TestBed.configureTestingModule({
      imports: [OrganizationReportingRoutingModule],
      providers: [
        { provide: ConfigService, useValue: configService },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: DialogService, useValue: dialogService },
        provideRouter([]),
      ],
    });

    injector = TestBed.inject(EnvironmentInjector);

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

    route = findRoute(TestBed.inject(Router).config) as Route;
  });

  it("is registered under the path its sibling reports use", () => {
    expect(route).toBeDefined();
  });

  it("evaluates the feature flag before the product tier guard", async () => {
    configService.getFeatureFlag.mockResolvedValue(false);

    const guards = (route.canActivate ?? []) as CanActivateFn[];
    expect(guards).toHaveLength(2);

    const result = await runInInjectionContext(injector, () =>
      guards[0](snapshotFor(organizationId), {} as RouterStateSnapshot),
    );

    expect(result).toBeInstanceOf(UrlTree);
    expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
  });
});
