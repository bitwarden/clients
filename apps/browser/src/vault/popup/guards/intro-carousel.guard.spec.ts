import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { IntroCarouselService } from "../services/intro-carousel.service";

import { IntroCarouselGuard } from "./intro-carousel.guard";

describe("IntroCarouselGuard", () => {
  let mockConfigService: MockProxy<ConfigService>;
  const mockIntroCarouselService = {
    introCarouselState$: of(true),
  };
  const createUrlTree = jest.fn();

  beforeEach(() => {
    mockConfigService = mock<ConfigService>();
    createUrlTree.mockClear();

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { createUrlTree } },
        { provide: ConfigService, useValue: mockConfigService },
        {
          provide: IntroCarouselService,
          useValue: mockIntroCarouselService,
        },
      ],
    });
  });

  it("should return true if the feature flag is off", async () => {
    mockConfigService.getFeatureFlag.mockResolvedValue(false);
    const result = await TestBed.runInInjectionContext(async () => await IntroCarouselGuard());
    expect(result).toBe(true);
  });
  it("should navigate to intro-carousel route if feature flag is true and dismissed is true", async () => {
    mockConfigService.getFeatureFlag.mockResolvedValue(true);
    const result = await TestBed.runInInjectionContext(async () => await IntroCarouselGuard());
    expect(result).toBe(true);
  });

  it("should navigate to intro-carousel route if feature flag is true and dismissed is false", async () => {
    TestBed.overrideProvider(IntroCarouselService, {
      useValue: { introCarouselState$: of(false) },
    });
    mockConfigService.getFeatureFlag.mockResolvedValue(true);
    await TestBed.runInInjectionContext(async () => await IntroCarouselGuard());
    expect(createUrlTree).toHaveBeenCalledWith(["/intro-carousel"]);
  });
});
