import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { of } from "rxjs";

import { IntroCarouselService } from "../services/intro-carousel.service";

import { IntroCarouselGuard } from "./intro-carousel.guard";

describe("IntroCarouselGuard", () => {
  const mockIntroCarouselService = {
    introCarouselState$: of(true),
  };
  const createUrlTree = jest.fn();

  beforeEach(() => {
    createUrlTree.mockClear();

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { createUrlTree } },
        {
          provide: IntroCarouselService,
          useValue: mockIntroCarouselService,
        },
      ],
    });
  });

  it("should return true when dismissed is true", async () => {
    const result = await TestBed.runInInjectionContext(async () => await IntroCarouselGuard());
    expect(result).toBe(true);
  });

  it("should navigate to intro-carousel route when dismissed is false", async () => {
    TestBed.overrideProvider(IntroCarouselService, {
      useValue: { introCarouselState$: of(false) },
    });

    await TestBed.runInInjectionContext(async () => await IntroCarouselGuard());
    expect(createUrlTree).toHaveBeenCalledWith(["/intro-carousel"]);
  });
});
