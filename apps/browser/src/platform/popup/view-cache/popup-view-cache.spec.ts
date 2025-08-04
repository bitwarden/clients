import { Component, inject, Injector } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { FormControl, FormGroup } from "@angular/forms";
import { Router } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { MockProxy, mock } from "jest-mock-extended";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { MessageSender } from "@bitwarden/common/platform/messaging";
import { GlobalStateProvider } from "@bitwarden/common/platform/state";
import { FakeGlobalState, FakeGlobalStateProvider } from "@bitwarden/common/spec";

import {
  ClEAR_VIEW_CACHE_COMMAND,
  POPUP_VIEW_CACHE_KEY,
  SAVE_VIEW_CACHE_COMMAND,
  ViewCacheState,
} from "../../services/popup-view-cache-background.service";

import { PopupViewCacheService } from "./popup-view-cache.service";

@Component({
  template: "",
  standalone: false,
})
export class EmptyComponent {}

@Component({
  template: "",
  standalone: false,
})
export class TestComponent {
  private viewCacheService = inject(PopupViewCacheService);

  formGroup = this.viewCacheService.formGroup({
    key: "test-form-cache",
    control: new FormGroup({
      name: new FormControl("initial name"),
    }),
  });

  signal = this.viewCacheService.signal({
    key: "test-signal",
    initialValue: "initial signal",
    persistNavigation: true,
  });
}

describe("popup view cache", () => {
  const configServiceMock = mock<ConfigService>();
  let testBed: TestBed;
  let service: PopupViewCacheService;
  let fakeGlobalState: FakeGlobalState<Record<string, ViewCacheState>>;
  let messageSenderMock: MockProxy<MessageSender>;
  let router: Router;

  const initServiceWithState = async (state: Record<string, ViewCacheState>) => {
    await fakeGlobalState.update(() => state);
    await service.init();
  };

  beforeEach(async () => {
    jest.spyOn(configServiceMock, "getFeatureFlag").mockResolvedValue(true);
    messageSenderMock = mock<MessageSender>();

    const fakeGlobalStateProvider = new FakeGlobalStateProvider();
    fakeGlobalState = fakeGlobalStateProvider.getFake(POPUP_VIEW_CACHE_KEY);

    testBed = TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([
          { path: "a", component: EmptyComponent },
          { path: "b", component: EmptyComponent },
        ]),
      ],
      providers: [
        { provide: GlobalStateProvider, useValue: fakeGlobalStateProvider },
        { provide: MessageSender, useValue: messageSenderMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    });

    await testBed.compileComponents();

    router = testBed.inject(Router);
    service = testBed.inject(PopupViewCacheService);
  });

  it("should initialize signal when ran within an injection context", async () => {
    await initServiceWithState({});

    const signal = TestBed.runInInjectionContext(() =>
      service.signal({
        key: "foo-123",
        initialValue: "foo",
      }),
    );

    expect(signal()).toBe("foo");
  });

  it("should initialize signal when provided an injector", async () => {
    await initServiceWithState({});

    const injector = TestBed.inject(Injector);

    const signal = service.signal({
      key: "foo-123",
      initialValue: "foo",
      injector,
    });

    expect(signal()).toBe("foo");
  });

  it("should initialize signal from state", async () => {
    await initServiceWithState({
      "foo-123": {
        value: JSON.stringify("bar"),
      },
    });

    const injector = TestBed.inject(Injector);

    const signal = service.signal({
      key: "foo-123",
      initialValue: "foo",
      injector,
    });

    expect(signal()).toBe("bar");
  });

  it("should initialize form from state", async () => {
    await initServiceWithState({
      "test-form-cache": {
        value: JSON.stringify({ name: "baz" }),
      },
    });

    const fixture = TestBed.createComponent(TestComponent);
    const component = fixture.componentRef.instance;
    expect(component.formGroup.value.name).toBe("baz");
    expect(component.formGroup.dirty).toBe(true);
  });

  it("should not modify form when empty", async () => {
    await initServiceWithState({});

    const fixture = TestBed.createComponent(TestComponent);
    const component = fixture.componentRef.instance;
    expect(component.formGroup.value.name).toBe("initial name");
    expect(component.formGroup.dirty).toBe(false);
  });

  it("should utilize deserializer", async () => {
    await initServiceWithState({
      "foo-123": {
        value: JSON.stringify("bar"),
      },
    });

    const injector = TestBed.inject(Injector);

    const signal = service.signal({
      key: "foo-123",
      initialValue: "foo",
      injector,
      deserializer: (jsonValue) => "test",
    });

    expect(signal()).toBe("test");
  });

  it("should not utilize deserializer when empty", async () => {
    await initServiceWithState({});

    const injector = TestBed.inject(Injector);

    const signal = service.signal({
      key: "foo-123",
      initialValue: "foo",
      injector,
      deserializer: (jsonValue) => "test",
    });

    expect(signal()).toBe("foo");
  });

  it("should send signal updates to message sender", async () => {
    await initServiceWithState({});

    const fixture = TestBed.createComponent(TestComponent);
    const component = fixture.componentRef.instance;
    component.signal.set("Foobar");
    fixture.detectChanges();

    expect(messageSenderMock.send).toHaveBeenCalledWith(SAVE_VIEW_CACHE_COMMAND, {
      key: "test-signal",
      value: JSON.stringify("Foobar"),
      options: {
        persistNavigation: true,
      },
    });
  });

  it("should send form updates to message sender", async () => {
    await initServiceWithState({});

    const fixture = TestBed.createComponent(TestComponent);
    const component = fixture.componentRef.instance;
    component.formGroup.controls.name.setValue("Foobar");
    fixture.detectChanges();

    expect(messageSenderMock.send).toHaveBeenCalledWith(SAVE_VIEW_CACHE_COMMAND, {
      key: "test-form-cache",
      value: JSON.stringify({ name: "Foobar" }),
      options: {},
    });
  });

  it("should clear on 2nd navigation", async () => {
    await initServiceWithState({
      temp: {
        value: "state",
        options: {},
      },
    });

    await router.navigate(["a"]);
    expect(messageSenderMock.send).toHaveBeenCalledTimes(0);
    expect(service["_cache"]).toEqual({
      temp: {
        value: "state",
        options: {},
      },
    });

    await router.navigate(["b"]);
    expect(messageSenderMock.send).toHaveBeenCalledWith(ClEAR_VIEW_CACHE_COMMAND, {
      routeChange: true,
    });
    expect(service["_cache"]).toEqual({});
  });

  it("should respect persistNavigation setting on 2nd navigation", async () => {
    await initServiceWithState({
      keepState: {
        value: "state",
        options: {
          persistNavigation: true,
        },
      },
      removeState: {
        value: "state",
        options: {
          persistNavigation: false,
        },
      },
    });

    await router.navigate(["a"]); // first navigation covered in previous test

    await router.navigate(["b"]);
    expect(messageSenderMock.send).toHaveBeenCalledWith(ClEAR_VIEW_CACHE_COMMAND, {
      routeChange: true,
    });
    expect(service["_cache"]).toEqual({
      keepState: {
        value: "state",
        options: {
          persistNavigation: true,
        },
      },
    });
  });
});
