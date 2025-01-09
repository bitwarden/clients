import { TestBed } from "@angular/core/testing";
import { Navigation, Router, UrlTree } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { unauthUiRefreshRedirect } from "./unauth-ui-refresh-redirect";

describe("unauthUiRefreshRedirect", () => {
  let configService: MockProxy<ConfigService>;
  let router: MockProxy<Router>;

  beforeEach(() => {
    configService = mock<ConfigService>();
    router = mock<Router>();

    TestBed.configureTestingModule({
      providers: [
        { provide: ConfigService, useValue: configService },
        { provide: Router, useValue: router },
      ],
    });
  });

  it("returns true when UnauthenticatedExtensionUIRefresh flag is disabled", async () => {
    configService.getFeatureFlag.mockResolvedValue(false);

    const result = await TestBed.runInInjectionContext(() =>
      unauthUiRefreshRedirect("/redirect")(),
    );

    expect(result).toBe(true);
    expect(configService.getFeatureFlag).toHaveBeenCalledWith(
      FeatureFlag.UnauthenticatedExtensionUIRefresh,
    );
    expect(router.parseUrl).not.toHaveBeenCalled();
  });

  it("returns UrlTree when UnauthenticatedExtensionUIRefresh flag is enabled and preserves query params", async () => {
    configService.getFeatureFlag.mockResolvedValue(true);

    const urlTree = new UrlTree();
    urlTree.queryParams = { test: "test" };

    const navigation: Navigation = {
      extras: {},
      id: 0,
      initialUrl: new UrlTree(),
      extractedUrl: urlTree,
      trigger: "imperative",
      previousNavigation: undefined,
    };

    router.getCurrentNavigation.mockReturnValue(navigation);

    await TestBed.runInInjectionContext(() => unauthUiRefreshRedirect("/redirect")());

    expect(configService.getFeatureFlag).toHaveBeenCalledWith(
      FeatureFlag.UnauthenticatedExtensionUIRefresh,
    );
    expect(router.createUrlTree).toHaveBeenCalledWith(["/redirect"], {
      queryParams: urlTree.queryParams,
    });
  });
});
