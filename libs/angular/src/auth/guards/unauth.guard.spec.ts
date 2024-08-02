import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { EmptyComponent } from "@bitwarden/angular/platform/guard/feature-flag.guard.spec";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";

import { unauthGuardFn } from "./unauth.guard";

describe("UnauthGuard", () => {
  const setup = (authStatus: AuthenticationStatus) => {
    const authService: MockProxy<AuthService> = mock<AuthService>();
    authService.getAuthStatus.mockResolvedValue(authStatus);
    const activeAccountStatusObservable = new BehaviorSubject<AuthenticationStatus>(authStatus);
    authService.activeAccountStatus$ = activeAccountStatusObservable;

    const testBed = TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([
          { path: "", component: EmptyComponent },
          {
            path: "unauth-guarded-route",
            component: EmptyComponent,
            canActivate: [unauthGuardFn()],
          },
          { path: "vault", component: EmptyComponent },
          { path: "lock", component: EmptyComponent },
          { path: "testhomepage", component: EmptyComponent },
          { path: "testlocked", component: EmptyComponent },
          {
            path: "testOverrides",
            component: EmptyComponent,
            canActivate: [
              unauthGuardFn({ homepage: () => "/testhomepage", locked: "/testlocked" }),
            ],
          },
        ]),
      ],
      providers: [{ provide: AuthService, useValue: authService }],
    });

    return {
      router: testBed.inject(Router),
    };
  };

  it("should be created", () => {
    const { router } = setup(AuthenticationStatus.LoggedOut);
    expect(router).toBeTruthy();
  });

  it("should redirect to /vault for guarded routes when logged in and unlocked", async () => {
    const { router } = setup(AuthenticationStatus.Unlocked);

    await router.navigateByUrl("unauth-guarded-route");
    expect(router.url).toBe("/vault");
  });

  it("should allow access to guarded routes when logged out", async () => {
    const { router } = setup(AuthenticationStatus.LoggedOut);

    await router.navigateByUrl("unauth-guarded-route");
    expect(router.url).toBe("/unauth-guarded-route");
  });

  it("should redirect to /lock for guarded routes when locked", async () => {
    const { router } = setup(AuthenticationStatus.Locked);

    await router.navigateByUrl("unauth-guarded-route");
    expect(router.url).toBe("/lock");
  });

  it("should redirect to /testhomepage for guarded routes when testOverrides are provided and the account is unlocked", async () => {
    const { router } = setup(AuthenticationStatus.Unlocked);

    await router.navigateByUrl("testOverrides");
    expect(router.url).toBe("/testhomepage");
  });

  it("should redirect to /testlocked for guarded routes when testOverrides are provided and the account is locked", async () => {
    const { router } = setup(AuthenticationStatus.Locked);

    await router.navigateByUrl("testOverrides");
    expect(router.url).toBe("/testlocked");
  });
});
