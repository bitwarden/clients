import { TestBed } from "@angular/core/testing";
import {
  ActivatedRouteSnapshot,
  provideRouter,
  RouterStateSnapshot,
  UrlTree,
} from "@angular/router";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { importUpgradeRequiredGuard as guard } from "./import-upgrade-required.guard";

describe("importUpgradeRequiredGuard", () => {
  const mockRoute = {} as ActivatedRouteSnapshot;
  const mockState = {} as RouterStateSnapshot;

  let getFeatureFlag: jest.Mock;

  beforeEach(() => {
    getFeatureFlag = jest.fn().mockResolvedValue(true);

    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ConfigService, useValue: { getFeatureFlag } }],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("allows navigation when the flag is on", async () => {
    const result = await TestBed.runInInjectionContext(() => guard(mockRoute, mockState));

    expect(result).toBe(true);
  });

  it("checks the ImportUpgrade flag specifically", async () => {
    await TestBed.runInInjectionContext(() => guard(mockRoute, mockState));

    expect(getFeatureFlag).toHaveBeenCalledWith(FeatureFlag.ImportUpgrade);
  });

  it("redirects to the vault tab when the flag is off", async () => {
    getFeatureFlag.mockResolvedValue(false);

    const result = await TestBed.runInInjectionContext(() => guard(mockRoute, mockState));

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe("/tabs/vault");
  });
});
