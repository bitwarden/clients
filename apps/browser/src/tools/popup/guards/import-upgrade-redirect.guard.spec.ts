import { TestBed } from "@angular/core/testing";
import {
  ActivatedRouteSnapshot,
  provideRouter,
  RouterStateSnapshot,
  UrlTree,
} from "@angular/router";
import { mock } from "jest-mock-extended";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { ImportUpgradeNavigationService } from "../settings/import/import-upgrade-navigation.service";

import { importUpgradeRedirectGuard as guard } from "./import-upgrade-redirect.guard";

describe("importUpgradeRedirectGuard", () => {
  const mockRoute = {} as ActivatedRouteSnapshot;
  const mockState = {} as RouterStateSnapshot;

  let getFeatureFlag: jest.Mock;
  let importUpgradeNavigationService: jest.Mocked<ImportUpgradeNavigationService>;

  beforeEach(() => {
    getFeatureFlag = jest.fn().mockResolvedValue(false);
    importUpgradeNavigationService = mock<ImportUpgradeNavigationService>();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ConfigService, useValue: { getFeatureFlag } },
        { provide: ImportUpgradeNavigationService, useValue: importUpgradeNavigationService },
      ],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("allows navigation when the flag is off", async () => {
    const result = await TestBed.runInInjectionContext(() => guard(mockRoute, mockState));

    expect(result).toBe(true);
    expect(importUpgradeNavigationService.openImportSourceSelectTab).not.toHaveBeenCalled();
  });

  it("checks the ImportUpgrade flag specifically", async () => {
    await TestBed.runInInjectionContext(() => guard(mockRoute, mockState));

    expect(getFeatureFlag).toHaveBeenCalledWith(FeatureFlag.ImportUpgrade);
  });

  it("redirects to the vault tab and opens the import picker's own extension tab when the flag is on", async () => {
    getFeatureFlag.mockResolvedValue(true);

    const result = await TestBed.runInInjectionContext(() => guard(mockRoute, mockState));

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe("/tabs/vault");
    expect(importUpgradeNavigationService.openImportSourceSelectTab).toHaveBeenCalled();
  });
});
