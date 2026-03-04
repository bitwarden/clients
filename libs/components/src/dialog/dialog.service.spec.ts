import { Dialog as CdkDialog } from "@angular/cdk/dialog";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";

import { DialogService } from "./dialog.service";
import { DrawerService } from "./drawer.service";

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
  let drawerService: MockProxy<DrawerService>;
  let cdkDialog: MockProxy<CdkDialog>;
  let routerHarness: RouterTestingHarness;
  let authStatus$: BehaviorSubject<AuthenticationStatus>;

  beforeEach(async () => {
    drawerService = mock<DrawerService>();
    cdkDialog = mock<CdkDialog>();
    authStatus$ = new BehaviorSubject<AuthenticationStatus>(AuthenticationStatus.Unlocked);

    TestBed.configureTestingModule({
      providers: [
        DialogService,
        { provide: DrawerService, useValue: drawerService },
        { provide: CdkDialog, useValue: cdkDialog },
        {
          provide: AuthService,
          useValue: {
            getAuthStatus: () => authStatus$,
          },
        },
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
  });

  describe("close drawer on navigation", () => {
    it("closes the drawer when navigating to a different route with closeOnNavigation enabled", async () => {
      service.openDrawer(TestDrawerComponent, { closeOnNavigation: true });

      await routerHarness.navigateByUrl("/other-route");

      expect(drawerService.close).toHaveBeenCalled();
    });

    it("does not close the drawer when navigating if closeOnNavigation is disabled", async () => {
      service.openDrawer(TestDrawerComponent, { closeOnNavigation: false });

      await routerHarness.navigateByUrl("/other-route");

      expect(drawerService.close).not.toHaveBeenCalled();
    });

    it("does not close the drawer when only query params change", async () => {
      service.openDrawer(TestDrawerComponent, { closeOnNavigation: true });

      await routerHarness.navigateByUrl("/?foo=bar");

      expect(drawerService.close).not.toHaveBeenCalled();
    });

    it("closes the drawer when the path changes but query params remain", async () => {
      service.openDrawer(TestDrawerComponent, { closeOnNavigation: true });

      await routerHarness.navigateByUrl("/other-route?foo=bar");

      expect(drawerService.close).toHaveBeenCalled();
    });

    it("does not close the drawer by default when closeOnNavigation is not specified", async () => {
      service.openDrawer(TestDrawerComponent);

      await routerHarness.navigateByUrl("/other-route");

      expect(drawerService.close).not.toHaveBeenCalled();
    });
  });
});
