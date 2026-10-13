import { TestBed } from "@angular/core/testing";
import { ActivatedRouteSnapshot, RouterStateSnapshot } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";

import { HasUnsavedChanges, unsavedChangesGuard } from "./unsaved-changes.guard";

describe("unsavedChangesGuard", () => {
  let status$: BehaviorSubject<AuthenticationStatus>;
  let component: MockProxy<HasUnsavedChanges>;

  beforeEach(() => {
    status$ = new BehaviorSubject<AuthenticationStatus>(AuthenticationStatus.Unlocked);
    component = mock<HasUnsavedChanges>();
    component.confirmLeave.mockReturnValue(Promise.resolve(false));

    const authService = mock<AuthService>();
    authService.activeAccountStatus$ = status$;

    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: authService }],
    });
  });

  function runGuard(target: HasUnsavedChanges | null): Promise<boolean> {
    return TestBed.runInInjectionContext(
      () =>
        unsavedChangesGuard(
          target as HasUnsavedChanges,
          mock<ActivatedRouteSnapshot>(),
          mock<RouterStateSnapshot>(),
          mock<RouterStateSnapshot>(),
        ) as Promise<boolean>,
    );
  }

  it("defers to the component while the account is unlocked", async () => {
    await expect(runGuard(component)).resolves.toBe(false);
    expect(component.confirmLeave).toHaveBeenCalledTimes(1);
  });

  it("accepts a component that answers synchronously", async () => {
    await expect(runGuard({ confirmLeave: () => true })).resolves.toBe(true);
  });

  it.each([
    ["locked", AuthenticationStatus.Locked],
    ["logged out", AuthenticationStatus.LoggedOut],
  ])("lets the navigation through without asking when the account is %s", async (_, status) => {
    status$.next(status);

    await expect(runGuard(component)).resolves.toBe(true);
    expect(component.confirmLeave).not.toHaveBeenCalled();
  });

  it("lets the navigation through when Angular passes no component", async () => {
    await expect(runGuard(null)).resolves.toBe(true);
  });
});
