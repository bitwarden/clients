import { TestBed } from "@angular/core/testing";
import { Router, provideRouter } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { EmptyComponent } from "@bitwarden/angular/platform/guard/feature-flag.guard.spec";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { UserId } from "@bitwarden/common/types/guid";

import { redirectToVaultIfUnlockedGuard } from "./redirect-to-vault-if-unlocked.guard";

describe("redirectToVaultIfUnlockedGuard", () => {
  const activeUser: Account = {
    id: "userId" as UserId,
    email: "test@email.com",
    emailVerified: true,
    name: "Test User",
  };

  const setup = (activeUser: Account | null, authStatus: AuthenticationStatus | null) => {
    const accountService = mock<AccountService>();
    const authService = mock<AuthService>();

    accountService.activeAccount$ = new BehaviorSubject<Account | null>(activeUser);
    authService.authStatusFor$.mockReturnValue(of(authStatus));

    const testBed = TestBed.configureTestingModule({
      providers: [
        { provide: AccountService, useValue: accountService },
        { provide: AuthService, useValue: authService },
        provideRouter([
          { path: "", component: EmptyComponent },
          { path: "vault", component: EmptyComponent },
          {
            path: "guarded-route",
            component: EmptyComponent,
            canActivate: [redirectToVaultIfUnlockedGuard()],
          },
        ]),
      ],
    });

    return {
      router: testBed.inject(Router),
    };
  };

  it("should be created", () => {
    const { router } = setup(null, null);
    expect(router).toBeTruthy();
  });

  it("should redirect to /vault if the user is AuthenticationStatus.Unlocked", async () => {
    // Arrange
    const { router } = setup(activeUser, AuthenticationStatus.Unlocked);

    // Act
    await router.navigate(["guarded-route"]);

    // Assert
    expect(router.url).toBe("/vault");
  });

  it("should allow navigation to continue to the route if there is no active user", async () => {
    // Arrange
    const { router } = setup(null, null);

    // Act
    await router.navigate(["guarded-route"]);

    // Assert
    expect(router.url).toBe("/guarded-route");
  });

  it("should allow navigation to continue to the route if the user is AuthenticationStatus.LoggedOut", async () => {
    // Arrange
    const { router } = setup(null, AuthenticationStatus.LoggedOut);

    // Act
    await router.navigate(["guarded-route"]);

    // Assert
    expect(router.url).toBe("/guarded-route");
  });

  it("should allow navigation to continue to the route if the user is AuthenticationStatus.Locked", async () => {
    // Arrange
    const { router } = setup(null, AuthenticationStatus.Locked);

    // Act
    await router.navigate(["guarded-route"]);

    // Assert
    expect(router.url).toBe("/guarded-route");
  });
});
