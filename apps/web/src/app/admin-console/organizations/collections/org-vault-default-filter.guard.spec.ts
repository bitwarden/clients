import { TestBed } from "@angular/core/testing";
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
  convertToParamMap,
  createUrlTreeFromSnapshot,
} from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { orgVaultDefaultFilterGuard } from "./org-vault-default-filter.guard";

jest.mock("@angular/router", () => ({
  ...jest.requireActual("@angular/router"),
  createUrlTreeFromSnapshot: jest.fn(),
}));

describe("orgVaultDefaultFilterGuard", () => {
  let configService: MockProxy<ConfigService>;

  const state = mock<RouterStateSnapshot>();
  const mockUrlTree = mock<UrlTree>();

  function makeRoute(queryParams: Record<string, string>): ActivatedRouteSnapshot {
    const route = mock<ActivatedRouteSnapshot>();
    Object.assign(route, { queryParams, queryParamMap: convertToParamMap(queryParams) });
    return route;
  }

  function runGuard(route: ActivatedRouteSnapshot) {
    return TestBed.runInInjectionContext(() => orgVaultDefaultFilterGuard(route, state));
  }

  beforeEach(() => {
    configService = mock<ConfigService>();
    jest.mocked(createUrlTreeFromSnapshot).mockReturnValue(mockUrlTree);

    TestBed.configureTestingModule({
      providers: [{ provide: ConfigService, useValue: configService }],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("leaves an unfiltered URL alone while VFO1Foundation is off", async () => {
    configService.getFeatureFlag.mockResolvedValue(false);

    await expect(runGuard(makeRoute({}))).resolves.toBe(true);
    expect(createUrlTreeFromSnapshot).not.toHaveBeenCalled();
  });

  it.each(["type", "sharedFolderId", "collectionId"])(
    "leaves a URL already carrying %s alone",
    async (param) => {
      configService.getFeatureFlag.mockResolvedValue(true);

      await expect(runGuard(makeRoute({ [param]: "all" }))).resolves.toBe(true);
      expect(createUrlTreeFromSnapshot).not.toHaveBeenCalled();
    },
  );

  it("redirects an unfiltered URL to the shared folder list, keeping unrelated params", async () => {
    configService.getFeatureFlag.mockResolvedValue(true);
    const route = makeRoute({ cipherId: "cipher-id" });

    await expect(runGuard(route)).resolves.toBe(mockUrlTree);
    expect(configService.getFeatureFlag).toHaveBeenCalledWith(FeatureFlag.VFO1Foundation);
    // The redirect target satisfies the pass-through check above, so the next activation stops here.
    expect(createUrlTreeFromSnapshot).toHaveBeenCalledWith(route, [], {
      cipherId: "cipher-id",
      sharedFolderId: "all",
    });
  });
});
