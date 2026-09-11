import { Dialog as CdkDialog } from "@angular/cdk/dialog";
import { GlobalPositionStrategy, PositionStrategy } from "@angular/cdk/overlay";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { LogService } from "@bitwarden/logging";

import { DIALOG_POSITION } from "./dialog-position";
import { CenterPositionStrategy, DialogService } from "./dialog.service";
import { DrawerService } from "./drawer.service";

@Component({
  selector: "test-dialog",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestDialogComponent {}

@Component({
  selector: "test-drawer",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestDrawerComponent {}

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

  describe("dialog position", () => {
    /** Whether the viewport is at or larger than the `md` breakpoint. */
    let largeScreen: boolean;

    const setScreenSize = (large: boolean) => {
      largeScreen = large;
      window.dispatchEvent(new Event("resize"));
    };

    /** Opens a dialog and returns the position signal handed to it, if any. */
    const openDialogPosition = (positionStrategy?: PositionStrategy) => {
      // `restoreFocus` is set so the service skips the async focus capture, which needs a real
      // CDK dialog ref.
      service.open(TestDialogComponent, { positionStrategy, restoreFocus: false });
      const config = cdkDialog.open.mock.calls.at(-1)![1]!;
      return config.injector!.get(DIALOG_POSITION, null);
    };

    beforeEach(() => {
      largeScreen = true;
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: jest.fn().mockImplementation((query: string) => ({
          matches: largeScreen,
          media: query,
        })),
      });
    });

    it("reports `center` on large screens", () => {
      setScreenSize(true);

      expect(openDialogPosition()!()).toBe("center");
    });

    it("reports `bottom` on small screens, where the dialog docks to the bottom edge", () => {
      setScreenSize(false);

      expect(openDialogPosition()!()).toBe("bottom");
    });

    it("updates when the viewport crosses the breakpoint", () => {
      setScreenSize(true);
      const position = openDialogPosition()!;

      setScreenSize(false);
      expect(position()).toBe("bottom");

      setScreenSize(true);
      expect(position()).toBe("center");
    });

    // Dialogs fall back to `center` when no position is provided.
    it("provides no position for a centered strategy", () => {
      setScreenSize(false);

      expect(openDialogPosition(new CenterPositionStrategy())).toBeNull();
    });

    it("provides no position for strategies that do not report one", () => {
      setScreenSize(false);

      expect(openDialogPosition(new GlobalPositionStrategy())).toBeNull();
    });
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
});
