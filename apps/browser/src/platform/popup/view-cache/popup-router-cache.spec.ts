import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { Router, UrlSerializer, UrlTree } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { GlobalStateProvider } from "@bitwarden/common/platform/state";
import { FakeGlobalStateProvider } from "@bitwarden/common/spec";

import { PopupRouterCacheService, popupRouterCacheGuard } from "./popup-router-cache.service";

const flushPromises = async () => await new Promise(process.nextTick);

@Component({
  template: "",
  standalone: false,
})
export class EmptyComponent {}

describe("Popup router cache guard", () => {
  const configServiceMock = mock<ConfigService>();
  const fakeGlobalStateProvider = new FakeGlobalStateProvider();

  let testBed: TestBed;
  let serializer: UrlSerializer;
  let router: Router;

  let service: PopupRouterCacheService;

  beforeEach(async () => {
    jest.spyOn(configServiceMock, "getFeatureFlag$").mockReturnValue(of(true));

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

    service = testBed.inject(PopupRouterCacheService);

    await service.setHistory([]);
  });

  it("returns true if the history stack is empty", async () => {
    const response = await firstValueFrom(
      testBed.runInInjectionContext(() => popupRouterCacheGuard()),
    );

    expect(response).toBe(true);
  });

  it("returns true if the history stack is null", async () => {
    await service.setHistory(null);

    const response = await firstValueFrom(
      testBed.runInInjectionContext(() => popupRouterCacheGuard()),
    );

    expect(response).toBe(true);
  });

  it("redirects to the latest stored route", async () => {
    await router.navigate(["a"]);
    await router.navigate(["b"]);

    const response = (await firstValueFrom(
      testBed.runInInjectionContext(() => popupRouterCacheGuard()),
    )) as UrlTree;

    expect(serializer.serialize(response)).toBe("/b");
  });

  it("back method redirects to the previous route", async () => {
    await router.navigate(["a"]);
    await router.navigate(["b"]);

    // wait for router events subscription
    await flushPromises();

    expect(await firstValueFrom(service.history$())).toEqual(["/a", "/b"]);

    await service.back();

    expect(await firstValueFrom(service.history$())).toEqual(["/a"]);
  });

  it("does not save ignored routes", async () => {
    await router.navigate(["a"]);
    await router.navigate(["b"]);
    await router.navigate(["c"]);

    const response = (await firstValueFrom(
      testBed.runInInjectionContext(() => popupRouterCacheGuard()),
    )) as UrlTree;

    expect(serializer.serialize(response)).toBe("/b");
  });

  it("does not save duplicate routes", async () => {
    await router.navigate(["a"]);
    await router.navigate(["a"]);

    await flushPromises();

    expect(await firstValueFrom(service.history$())).toEqual(["/a"]);
  });
});
