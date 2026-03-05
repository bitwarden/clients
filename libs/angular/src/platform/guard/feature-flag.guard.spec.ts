import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { CanActivateFn, Router } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { I18nMockService, ToastService } from "@bitwarden/components/src";

import { canAccessFeature } from "./feature-flag.guard";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({ template: "", standalone: false })
export class EmptyComponent {}

describe("canAccessFeature", () => {
  const testFlag: FeatureFlag = "test-flag" as FeatureFlag;
  const featureRoute = "enabled-feature";
  const redirectRoute = "redirect";

  let mockConfigService: MockProxy<ConfigService>;
  let mockToastService: MockProxy<ToastService>;

  const setup = (featureGuard: CanActivateFn, flagValue: any) => {
    mockConfigService = mock<ConfigService>();
    mockToastService = mock<ToastService>();

    // Mock the correct getter based on the type of flagValue; also mock default values if one is not provided
    if (typeof flagValue === "boolean") {
      mockConfigService.getFeatureFlag.mockImplementation((flag, defaultValue = false) =>
        flag == testFlag ? Promise.resolve(flagValue) : Promise.resolve(defaultValue),
      );
    } else if (typeof flagValue === "string") {
      mockConfigService.getFeatureFlag.mockImplementation((flag) =>
        flag == testFlag ? Promise.resolve(flagValue as any) : Promise.resolve(""),
      );
    } else if (typeof flagValue === "number") {
      mockConfigService.getFeatureFlag.mockImplementation((flag) =>
        flag == testFlag ? Promise.resolve(flagValue as any) : Promise.resolve(0),
      );
    }

    const testBed = TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([
          { path: "", component: EmptyComponent },
          {
            path: featureRoute,
            component: EmptyComponent,
            canActivate: [featureGuard],
          },
          { path: redirectRoute, component: EmptyComponent },
        ]),
      ],
      providers: [
        { provide: ConfigService, useValue: mockConfigService },
        { provide: ToastService, useValue: mockToastService },
        { provide: LogService, useValue: mock<LogService>() },
        {
          provide: I18nService,
          useValue: new I18nMockService({
            accessDenied: "Access Denied!",
          }),
        },
      ],
    });
    return {
      router: testBed.inject(Router),
    };
  };

  it("successfully navigates when the feature flag is enabled", async () => {
    const { router } = setup(canAccessFeature(testFlag), true);

    await router.navigate([featureRoute]);

    expect(router.url).toBe(`/${featureRoute}`);
  });

  it("successfully navigates when the feature flag value matches the required value", async () => {
    const { router } = setup(canAccessFeature(testFlag, "some-value"), "some-value");

    await router.navigate([featureRoute]);

    expect(router.url).toBe(`/${featureRoute}`);
  });

  it("fails to navigate when the feature flag is disabled", async () => {
    const { router } = setup(canAccessFeature(testFlag), false);

    await router.navigate([featureRoute]);

    expect(router.url).toBe("/");
  });

  it("fails to navigate when the feature flag value does not match the required value", async () => {
    const { router } = setup(canAccessFeature(testFlag, "some-value"), "some-wrong-value");

    await router.navigate([featureRoute]);

    expect(router.url).toBe("/");
  });

  it("fails to navigate when the feature flag does not exist", async () => {
    const { router } = setup(canAccessFeature("missing-flag" as FeatureFlag), true);

    await router.navigate([featureRoute]);

    expect(router.url).toBe("/");
  });

  it("shows an error toast when the feature flag is disabled", async () => {
    const { router } = setup(canAccessFeature(testFlag), false);

    await router.navigate([featureRoute]);

    expect(mockToastService.showToast).toHaveBeenCalledWith({
      variant: "error",
      title: null,
      message: "Access Denied!",
    });
  });

  it("does not show an error toast when the feature flag is enabled", async () => {
    const { router } = setup(canAccessFeature(testFlag), true);

    await router.navigate([featureRoute]);

    expect(mockToastService.showToast).not.toHaveBeenCalled();
  });

  it("redirects to the specified redirect url when the feature flag is disabled", async () => {
    const { router } = setup(canAccessFeature(testFlag, true, redirectRoute), false);

    await router.navigate([featureRoute]);

    expect(router.url).toBe(`/${redirectRoute}`);
  });

  it("fails to navigate when the config service throws an unexpected exception", async () => {
    const { router } = setup(canAccessFeature(testFlag), true);

    mockConfigService.getFeatureFlag.mockImplementation(() => Promise.reject("Some error"));

    await router.navigate([featureRoute]);

    expect(router.url).toBe("/");
  });
});
