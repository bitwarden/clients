import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { Router, UrlSerializer, UrlTree } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { mock } from "jest-mock-extended";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { GlobalStateProvider } from "@bitwarden/common/platform/state";
import { FakeGlobalStateProvider } from "@bitwarden/common/spec";

import { PopupRouterCacheService, popupRouterCacheGuard } from "./popup-router-cache.service";

@Component({ template: "" })
export class EmptyComponent {}

describe("Popup router cache guard", () => {
  const configServiceMock = mock<ConfigService>();
  const fakeGlobalStateProvider = new FakeGlobalStateProvider();

  let testBed: TestBed;
  let serializer: UrlSerializer;
  let router: Router;

  beforeEach(async () => {
    jest.spyOn(configServiceMock, "getFeatureFlag").mockResolvedValue(true);

    testBed = TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([
          { path: "a", component: EmptyComponent },
          { path: "b", component: EmptyComponent },
          {
            path: "c",
            component: EmptyComponent,
            data: { doNotSaveUrl: true },
          },
        ]),
      ],
      providers: [
        { provide: ConfigService, useValue: configServiceMock },
        { provide: GlobalStateProvider, useValue: fakeGlobalStateProvider },
      ],
    });

    await testBed.compileComponents();

    router = testBed.inject(Router);
    serializer = testBed.inject(UrlSerializer);

    testBed.inject(PopupRouterCacheService);
  });

  it("returns true if empty", async () => {
    const response = await testBed.runInInjectionContext(() => popupRouterCacheGuard());

    expect(response).toBe(true);
  });

  it("redirects to the latest stored route", async () => {
    await router.navigate(["a"]);
    await router.navigate(["b"]);

    const response = (await testBed.runInInjectionContext(() =>
      popupRouterCacheGuard(),
    )) as UrlTree;

    expect(serializer.serialize(response)).toBe("/b");
    // expect(await service.last()).toBe("/a");
  });

  it("does not save ignored routes", async () => {
    await router.navigate(["a"]);
    await router.navigate(["b"]);
    await router.navigate(["c"]);

    const response = (await testBed.runInInjectionContext(() =>
      popupRouterCacheGuard(),
    )) as UrlTree;

    expect(serializer.serialize(response)).toBe("/b");
  });
});
