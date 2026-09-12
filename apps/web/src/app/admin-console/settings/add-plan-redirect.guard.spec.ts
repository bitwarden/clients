import { TestBed } from "@angular/core/testing";
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from "@angular/router";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { addPlanRedirectGuard } from "./add-plan-redirect.guard";

describe("addPlanRedirectGuard", () => {
  const _state = Object.freeze({}) as RouterStateSnapshot;
  const emptyRoute = Object.freeze({
    queryParams: {},
    fragment: null,
  }) as ActivatedRouteSnapshot;

  const createUrlTree = jest.fn();
  const getFeatureFlag = jest.fn().mockResolvedValue(false);
  const logError = jest.fn();

  beforeEach(() => {
    createUrlTree.mockClear();
    getFeatureFlag.mockClear();
    logError.mockClear();

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { createUrlTree } },
        { provide: ConfigService, useValue: { getFeatureFlag } },
        { provide: LogService, useValue: { error: logError } },
      ],
    });
  });

  function runGuard(route?: ActivatedRouteSnapshot) {
    // Run the guard within injection context so `inject` works as you'd expect
    return TestBed.runInInjectionContext(async () =>
      addPlanRedirectGuard(route ?? emptyRoute, _state),
    );
  }

  it("returns `true` when the VFO1 foundation flag is off", async () => {
    getFeatureFlag.mockResolvedValueOnce(false);

    expect(await runGuard()).toBe(true);
    expect(getFeatureFlag).toHaveBeenCalledWith(FeatureFlag.VFO1Foundation);
    expect(createUrlTree).not.toHaveBeenCalled();
  });

  it("redirects to settings/add-plan when the flag is on", async () => {
    const urlTree = { toString: () => "/settings/add-plan" };
    createUrlTree.mockReturnValueOnce(urlTree);
    getFeatureFlag.mockResolvedValueOnce(true);

    const result = await runGuard();

    expect(createUrlTree).toHaveBeenCalledWith(["/settings/add-plan"], {
      queryParams: {},
      fragment: undefined,
    });
    expect(result).toBe(urlTree);
  });

  it("preserves marketing deep-link query params on redirect", async () => {
    const urlTree = { toString: () => "/settings/add-plan" };
    createUrlTree.mockReturnValueOnce(urlTree);
    getFeatureFlag.mockResolvedValueOnce(true);
    const route = Object.freeze({
      queryParams: { plan: "enterprise", product: "1", trialLength: "7" },
      fragment: null,
    }) as unknown as ActivatedRouteSnapshot;

    const result = await runGuard(route);

    expect(createUrlTree).toHaveBeenCalledWith(["/settings/add-plan"], {
      queryParams: { plan: "enterprise", product: "1", trialLength: "7" },
      fragment: undefined,
    });
    expect(result).toBe(urlTree);
  });

  it("preserves the URL fragment on redirect", async () => {
    const urlTree = { toString: () => "/settings/add-plan" };
    createUrlTree.mockReturnValueOnce(urlTree);
    getFeatureFlag.mockResolvedValueOnce(true);
    const route = Object.freeze({
      queryParams: {},
      fragment: "some-anchor",
    }) as unknown as ActivatedRouteSnapshot;

    const result = await runGuard(route);

    expect(createUrlTree).toHaveBeenCalledWith(["/settings/add-plan"], {
      queryParams: {},
      fragment: "some-anchor",
    });
    expect(result).toBe(urlTree);
  });

  it("fails open and logs when the flag check throws", async () => {
    const error = new Error("flag lookup failed");
    getFeatureFlag.mockRejectedValueOnce(error);

    expect(await runGuard()).toBe(true);
    expect(logError).toHaveBeenCalledWith("Error in addPlanRedirectGuard", error);
    expect(createUrlTree).not.toHaveBeenCalled();
  });
});
