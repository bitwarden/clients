import { Dialog as CdkDialog, DIALOG_DATA } from "@angular/cdk/dialog";
import { ComponentPortal, PortalModule } from "@angular/cdk/portal";
import { ChangeDetectionStrategy, Component, Injectable, OnDestroy, inject } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { LogService } from "@bitwarden/logging";

import { DialogRef } from "./dialog-ref";
import { DialogService } from "./dialog.service";
import { DrawerService } from "./drawer.service";

@Component({
  selector: "test-drawer",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestDrawerComponent {}

/** Stands in for a service a dialog needs that is not `providedIn: "root"`. */
@Injectable()
class TestDialogDependency {}

/** Stands in for the service a dialog injects, which has a dependency of its own. */
@Injectable()
class TestDialogService {
  readonly dependency = inject(TestDialogDependency);
}

@Component({
  selector: "test-initial-route",
  template: "<h1>Initial Route</h1>",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class InitialRouteComponent {}

@Component({
  selector: "test-other-route",
  template: "<h1>Other Route</h1>",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class OtherRouteComponent {}

describe("DialogService", () => {
  let service: DialogService;
  let drawerService: DrawerService;
  let cdkDialog: MockProxy<CdkDialog>;
  let routerHarness: RouterTestingHarness;
  let authStatus$: BehaviorSubject<AuthenticationStatus>;
  let logService: MockProxy<LogService>;

  beforeEach(async () => {
    cdkDialog = mock<CdkDialog>();
    authStatus$ = new BehaviorSubject<AuthenticationStatus>(AuthenticationStatus.Unlocked);
    logService = mock<LogService>();

    TestBed.configureTestingModule({
      providers: [
        DialogService,
        { provide: CdkDialog, useValue: cdkDialog },
        {
          provide: AuthService,
          useValue: {
            getAuthStatus: () => authStatus$,
          },
        },
        { provide: LogService, useValue: logService },
        provideRouter([
          { path: "", component: InitialRouteComponent },
          { path: "other-route", component: OtherRouteComponent },
          { path: "another-route", component: OtherRouteComponent },
        ]),
      ],
    });

    routerHarness = await RouterTestingHarness.create();
    // Navigate to the initial route to set up the router state
    await routerHarness.navigateByUrl("/");

    service = TestBed.inject(DialogService);
    drawerService = TestBed.inject(DrawerService);
    jest.spyOn(drawerService, "forceCloseAll");
  });

  describe("close drawer on navigation", () => {
    it("closes the drawer when navigating to a different route with closeOnNavigation enabled", async () => {
      await service.openDrawer(TestDrawerComponent, { closeOnNavigation: true });

      // Reset the spy after openDrawer's upfront cleanup so we only measure the navigation effect.
      jest.mocked(drawerService.forceCloseAll).mockClear();

      await routerHarness.navigateByUrl("/other-route");

      expect(drawerService.forceCloseAll).toHaveBeenCalled();
    });

    it("does not close the drawer when navigating if closeOnNavigation is disabled", async () => {
      await service.openDrawer(TestDrawerComponent, { closeOnNavigation: false });

      // Reset the spy after openDrawer's upfront cleanup so we only measure the navigation effect.
      jest.mocked(drawerService.forceCloseAll).mockClear();

      await routerHarness.navigateByUrl("/other-route");

      expect(drawerService.forceCloseAll).not.toHaveBeenCalled();
    });

    it("does not close the drawer when only query params change", async () => {
      await service.openDrawer(TestDrawerComponent, { closeOnNavigation: true });

      // Reset the spy after openDrawer's upfront cleanup so we only measure the navigation effect.
      jest.mocked(drawerService.forceCloseAll).mockClear();

      await routerHarness.navigateByUrl("/?foo=bar");

      expect(drawerService.forceCloseAll).not.toHaveBeenCalled();
    });

    it("closes the drawer when the path changes but query params remain", async () => {
      await service.openDrawer(TestDrawerComponent, { closeOnNavigation: true });

      // Reset the spy after openDrawer's upfront cleanup so we only measure the navigation effect.
      jest.mocked(drawerService.forceCloseAll).mockClear();

      await routerHarness.navigateByUrl("/other-route?foo=bar");

      expect(drawerService.forceCloseAll).toHaveBeenCalled();
    });

    it("does not close the drawer by default when closeOnNavigation is not specified", async () => {
      await service.openDrawer(TestDrawerComponent);

      // Reset the spy after openDrawer's upfront cleanup so we only measure the navigation effect.
      jest.mocked(drawerService.forceCloseAll).mockClear();

      await routerHarness.navigateByUrl("/other-route");

      expect(drawerService.forceCloseAll).not.toHaveBeenCalled();
    });
  });

  describe("providers", () => {
    it("resolves a dialog's own providers, including their dependencies", () => {
      // `restoreFocus: false` skips setRestoreFocusEl, which reads the CDK ref that the mocked
      // CdkDialog does not return. Not relevant to what is under test here.
      service.open(TestDrawerComponent, {
        providers: [TestDialogService, TestDialogDependency],
        restoreFocus: false,
      });

      const injector = cdkDialog.open.mock.calls[0][1]?.injector;

      expect(injector?.get(TestDialogService).dependency).toBeInstanceOf(TestDialogDependency);
    });

    it("keeps the dialog's own tokens available alongside caller providers", () => {
      service.open(TestDrawerComponent, {
        data: { some: "data" },
        providers: [TestDialogDependency],
        restoreFocus: false,
      });

      const injector = cdkDialog.open.mock.calls[0][1]?.injector;

      expect(injector?.get(DIALOG_DATA)).toEqual({ some: "data" });
      expect(injector?.get(DialogRef)).toBeDefined();
    });

    it("does not forward providers to the CDK config", () => {
      service.open(TestDrawerComponent, {
        providers: [TestDialogDependency],
        restoreFocus: false,
      });

      expect(cdkDialog.open.mock.calls[0][1]).not.toHaveProperty("providers");
    });

    it("resolves providers for drawers as well as dialogs", async () => {
      const ref = await service.openDrawer(TestDrawerComponent, {
        providers: [TestDialogService, TestDialogDependency],
      });

      const injector = (ref?.portal as ComponentPortal<unknown>).injector;

      expect(injector?.get(TestDialogService).dependency).toBeInstanceOf(TestDialogDependency);
    });
  });
});

/**
 * Teardown order, appended to by every `ngOnDestroy` below. Reset before each test.
 *
 * The suite that follows deliberately uses the *real* CDK `Dialog` rather than a mock, because the
 * property under test — that a dialog's own providers are destroyed, and only once the dialog
 * component is gone — is a property of the real component/overlay teardown sequence.
 */
let destroyLog: string[] = [];

/** Only ever available through a dialog's own `providers`. */
@Injectable()
class ScopedService implements OnDestroy {
  ngOnDestroy() {
    destroyLog.push("scoped-service");
  }
}

/** Provided at module level, i.e. shared with the rest of the app. */
@Injectable()
class SharedService implements OnDestroy {
  ngOnDestroy() {
    destroyLog.push("shared-service");
  }
}

@Component({
  selector: "test-scoped-consumer",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ScopedConsumerComponent implements OnDestroy {
  readonly scoped = inject(ScopedService);

  ngOnDestroy() {
    destroyLog.push("component");
  }
}

@Component({
  selector: "test-shared-consumer",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class SharedConsumerComponent implements OnDestroy {
  readonly shared = inject(SharedService);

  ngOnDestroy() {
    destroyLog.push("component");
  }
}

/** Resolves its providers and then fails, so the dialog never finishes opening. */
@Component({
  selector: "test-throwing-consumer",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ThrowingConsumerComponent {
  constructor() {
    inject(ScopedService);
    throw new Error("could not construct");
  }
}

/** Stands in for `LayoutComponent`, which is what renders the drawer portal in the real app. */
@Component({
  selector: "test-drawer-host",
  template: `<ng-template [cdkPortalOutlet]="portal()"></ng-template>`,
  imports: [PortalModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class DrawerHostComponent {
  protected readonly portal = inject(DrawerService).portal;
}

describe("DialogService provider lifecycle", () => {
  let service: DialogService;
  let routerHarness: RouterTestingHarness;
  let authStatus$: BehaviorSubject<AuthenticationStatus>;
  let consoleError: jest.SpyInstance;

  beforeEach(async () => {
    destroyLog = [];
    authStatus$ = new BehaviorSubject<AuthenticationStatus>(AuthenticationStatus.Unlocked);

    /**
     * jsdom cannot parse the CDK's overlay stylesheet and dumps the whole thing as an error every
     * time an overlay is created. Angular surfaces genuine failures by rethrowing into the test
     * rather than logging, so silencing this loses nothing.
     */
    consoleError = jest.spyOn(console, "error").mockImplementation();

    TestBed.configureTestingModule({
      providers: [
        DialogService,
        SharedService,
        { provide: AuthService, useValue: { getAuthStatus: () => authStatus$ } },
        { provide: LogService, useValue: mock<LogService>() },
        provideRouter([
          { path: "", component: InitialRouteComponent },
          { path: "other-route", component: OtherRouteComponent },
        ]),
      ],
    });

    routerHarness = await RouterTestingHarness.create();
    await routerHarness.navigateByUrl("/");

    service = TestBed.inject(DialogService);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  describe("dialogs", () => {
    it("destroys a provided service when the dialog closes, after the dialog component", async () => {
      const ref = service.open(ScopedConsumerComponent, { providers: [ScopedService] });

      expect(ref.componentInstance?.scoped).toBeInstanceOf(ScopedService);
      expect(destroyLog).toEqual([]);

      await ref.close();

      expect(destroyLog).toEqual(["component", "scoped-service"]);
    });

    it("does not destroy a provided service when a closePredicate prevents the close", async () => {
      const ref = service.open(ScopedConsumerComponent, {
        providers: [ScopedService],
        closePredicate: () => Promise.resolve(false),
      });

      await expect(ref.close()).resolves.toEqual({ closed: false });

      expect(destroyLog).toEqual([]);
    });

    it("destroys a provided service on closeAll", () => {
      service.open(ScopedConsumerComponent, { providers: [ScopedService] });

      service.closeAll();

      expect(destroyLog).toEqual(["component", "scoped-service"]);
    });

    it("destroys a provided service when the vault locks on navigation", async () => {
      service.open(ScopedConsumerComponent, { providers: [ScopedService] });

      authStatus$.next(AuthenticationStatus.Locked);
      await routerHarness.navigateByUrl("/other-route");

      expect(destroyLog).toEqual(["component", "scoped-service"]);
    });

    it("destroys a provided service when the dialog fails to open", () => {
      expect(() => service.open(ThrowingConsumerComponent, { providers: [ScopedService] })).toThrow(
        "could not construct",
      );

      expect(destroyLog).toEqual(["scoped-service"]);
    });

    it("gives each open its own instances", () => {
      const first = service.open(ScopedConsumerComponent, { providers: [ScopedService] });
      const second = service.open(ScopedConsumerComponent, { providers: [ScopedService] });

      expect(second.componentInstance?.scoped).not.toBe(first.componentInstance?.scoped);
    });

    it("does not leak its providers into a dialog opened while it is open", () => {
      service.open(ScopedConsumerComponent, { providers: [ScopedService] });

      /**
       * Every `open` builds its injector from the environment injector `DialogService` was created
       * in, never from the dialog that happens to be open, so a nested dialog must declare the same
       * providers itself.
       */
      expect(() => service.open(ScopedConsumerComponent)).toThrow(
        "No provider found for `ScopedService`",
      );
    });

    it("shadows a module-level provider of the same token", () => {
      const shared = TestBed.inject(SharedService);

      const ref = service.open(SharedConsumerComponent, { providers: [SharedService] });

      expect(ref.componentInstance?.shared).not.toBe(shared);
    });

    it("leaves a dialog that declares no providers untouched on close", async () => {
      const ref = service.open(SharedConsumerComponent);

      expect(ref.componentInstance?.shared).toBe(TestBed.inject(SharedService));

      await ref.close();

      // Only the component. The module-level `SharedService` is shared with the rest of the app and
      // must survive; without `providers` there is no extra injector to destroy at all.
      expect(destroyLog).toEqual(["component"]);
    });
  });

  /**
   * Renders the drawer portal and flushes change detection plus after-render hooks. Call it once per
   * test: a portal cannot be attached to two outlets, so a second host would fail to render.
   *
   * `autoDetectChanges` puts the host in every `ApplicationRef.tick()`, not just the explicit
   * `TestBed.tick()` calls, so the host is refreshed in the same pass that runs the after-render
   * hooks — which is the ordering the real app gets.
   */
  const renderDrawerHost = () => {
    TestBed.createComponent(DrawerHostComponent).autoDetectChanges();
    TestBed.tick();
  };

  describe("drawers", () => {
    it("destroys a provided service when the drawer closes, after the drawer component", async () => {
      const ref = await service.openDrawer(ScopedConsumerComponent, {
        providers: [ScopedService],
      });
      renderDrawerHost();

      expect(destroyLog).toEqual([]);

      await ref!.close();

      // A drawer's `closed` fires while its component is still mounted — the portal is only
      // detached on the next change detection pass.
      expect(destroyLog).toEqual([]);

      TestBed.tick();

      expect(destroyLog).toEqual(["component", "scoped-service"]);
    });

    it("does not destroy a provided service when a closePredicate prevents the close", async () => {
      const ref = await service.openDrawer(ScopedConsumerComponent, {
        providers: [ScopedService],
        closePredicate: () => Promise.resolve(false),
      });
      renderDrawerHost();

      await expect(ref!.close()).resolves.toEqual({ closed: false });
      TestBed.tick();

      expect(destroyLog).toEqual([]);
    });

    it("destroys a provided service on closeAll", async () => {
      await service.openDrawer(ScopedConsumerComponent, { providers: [ScopedService] });
      renderDrawerHost();

      service.closeAll();
      TestBed.tick();

      expect(destroyLog).toEqual(["component", "scoped-service"]);
    });

    it("destroys a provided service when the drawer closes on navigation", async () => {
      await service.openDrawer(ScopedConsumerComponent, {
        providers: [ScopedService],
        closeOnNavigation: true,
      });
      renderDrawerHost();

      await routerHarness.navigateByUrl("/other-route");
      TestBed.tick();

      expect(destroyLog).toEqual(["component", "scoped-service"]);
    });

    it("keeps a buried drawer's providers alive so it can be restored", async () => {
      const root = await service.openDrawer(ScopedConsumerComponent, {
        providers: [ScopedService],
      });
      renderDrawerHost();
      const original = (root!.portal as ComponentPortal<ScopedConsumerComponent>).injector!.get(
        ScopedService,
      );

      // Stacking a child destroys the root's component but must not destroy its providers.
      const child = root!.stack(ScopedConsumerComponent, { providers: [ScopedService] });
      TestBed.tick();

      expect(destroyLog).toEqual(["component"]);

      await child.close();
      TestBed.tick();

      expect(
        (root!.portal as ComponentPortal<ScopedConsumerComponent>).injector!.get(ScopedService),
      ).toBe(original);
    });

    it("leaves a drawer that declares no providers untouched on close", async () => {
      const ref = await service.openDrawer(SharedConsumerComponent);
      renderDrawerHost();

      await ref!.close();
      TestBed.tick();

      expect(destroyLog).toEqual(["component"]);
    });
  });

  /**
   * `DrawerRef.close()` clears its `closePredicate` and awaits it, which yields control. Anything
   * that happens while it is parked — a second close, a `closeAll()`, a newly stacked child — can
   * take the drawer off the top of the stack before the predicate resolves. A resume that does not
   * re-check that would pop whichever drawer is on top *now*, leaving that drawer's `closed`
   * observable uncompleted and its providers injector unreachable by every remaining teardown path.
   */
  describe("drawers closing concurrently", () => {
    let drawerService: DrawerService;

    /** A predicate that parks until the test resolves it, standing in for one that opens a dialog. */
    const parkedPredicate = () => {
      let resolve!: (canClose: boolean) => void;
      const predicate = jest.fn(() => new Promise<boolean>((r) => (resolve = r)));
      return { predicate, resume: (canClose: boolean) => resolve(canClose) };
    };

    beforeEach(() => {
      drawerService = TestBed.inject(DrawerService);
    });

    it("does not pop the root when a double close resumes on an already-closed child", async () => {
      const { predicate, resume } = parkedPredicate();
      const root = await service.openDrawer(ScopedConsumerComponent, {
        providers: [ScopedService],
      });
      renderDrawerHost();
      const child = root!.stack(ScopedConsumerComponent, {
        providers: [ScopedService],
        closePredicate: predicate,
      });
      TestBed.tick();

      // First click: the predicate parks, so this close is left mid-flight.
      const firstClose = child.close();
      // Second click: `closePredicate` was cleared for re-entrancy, so this one closes the child.
      await expect(child.close()).resolves.toEqual({ closed: true });
      TestBed.tick();

      expect(drawerService.isTop(root!)).toBe(true);

      // The parked close now resumes against a child that is already gone.
      resume(true);
      await expect(firstClose).resolves.toEqual({ closed: false });
      TestBed.tick();

      // The root is still open: the stale resume popped nothing.
      expect(drawerService.stackDepth()).toBe(1);
      expect(drawerService.isTop(root!)).toBe(true);

      // Closing the root normally still tears everything down — neither injector was orphaned.
      await root!.close();
      TestBed.tick();

      expect(destroyLog.filter((entry) => entry === "scoped-service")).toHaveLength(2);
    });

    it("does not pop a newly opened drawer when a close resumes after a concurrent closeAll", async () => {
      const { predicate, resume } = parkedPredicate();
      const first = await service.openDrawer(ScopedConsumerComponent, {
        providers: [ScopedService],
        closePredicate: predicate,
      });
      renderDrawerHost();

      // The user closes the drawer and its predicate parks on its own work...
      const closing = first!.close();

      // ...and while it is parked the vault locks, tearing the whole stack down.
      service.closeAll();
      TestBed.tick();

      expect(destroyLog).toEqual(["component", "scoped-service"]);

      // A new drawer takes its place.
      const second = await service.openDrawer(ScopedConsumerComponent, {
        providers: [ScopedService],
      });
      TestBed.tick();

      // The parked close resumes against a stack that no longer contains its drawer.
      resume(true);
      await expect(closing).resolves.toEqual({ closed: false });
      TestBed.tick();

      // The new drawer was not silently popped, and its providers are still alive.
      expect(drawerService.stackDepth()).toBe(1);
      expect(drawerService.isTop(second!)).toBe(true);
      expect(destroyLog).toEqual(["component", "scoped-service"]);

      await second!.close();
      TestBed.tick();

      expect(destroyLog).toEqual(["component", "scoped-service", "component", "scoped-service"]);
    });

    it("restores the closePredicate when a close resumes on a drawer that is no longer on top", async () => {
      const { predicate, resume } = parkedPredicate();
      const root = await service.openDrawer(ScopedConsumerComponent, {
        providers: [ScopedService],
        closePredicate: predicate,
      });
      renderDrawerHost();

      // The close parks with the predicate cleared, so a child can still be stacked over it.
      const closing = root!.close();
      root!.stack(ScopedConsumerComponent, { providers: [ScopedService] });
      TestBed.tick();

      resume(true);
      await expect(closing).resolves.toEqual({ closed: false });
      TestBed.tick();

      // The root is buried, not closed: it keeps its predicate and its providers for when the
      // child pops and it is restored.
      expect(drawerService.stackDepth()).toBe(2);
      expect(root!.closePredicate).toBe(predicate);
      expect(destroyLog).toEqual(["component"]);
    });

    it("keeps the closePredicate after it prevents a close, so the next close is still gated", async () => {
      const closePredicate = jest.fn().mockResolvedValue(false);
      const ref = await service.openDrawer(ScopedConsumerComponent, {
        providers: [ScopedService],
        closePredicate,
      });
      renderDrawerHost();

      await expect(ref!.close()).resolves.toEqual({ closed: false });

      expect(ref!.closePredicate).toBe(closePredicate);

      // Still gated: the second close consults the predicate again rather than closing outright.
      await expect(ref!.close()).resolves.toEqual({ closed: false });
      TestBed.tick();

      expect(closePredicate).toHaveBeenCalledTimes(2);
      expect(destroyLog).toEqual([]);
    });
  });
});
