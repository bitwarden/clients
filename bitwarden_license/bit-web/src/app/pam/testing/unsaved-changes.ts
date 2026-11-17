import { Injector, runInInjectionContext } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { ActivatedRouteSnapshot, RouterStateSnapshot } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";

import { HasUnsavedChangesDialog, unsavedChangesDialogGuard } from "../unsaved-changes.guard";

/**
 * Runs the route's discard guard against a component with the account unlocked, as the router
 * would. The guard's dialog comes from the spec's own `DialogService`.
 */
export function leaveThroughGuard(component: HasUnsavedChangesDialog): Promise<boolean> {
  const authService = mock<AuthService>();
  authService.activeAccountStatus$ = of(AuthenticationStatus.Unlocked);
  const injector = Injector.create({
    providers: [{ provide: AuthService, useValue: authService }],
    parent: TestBed.inject(Injector),
  });

  return runInInjectionContext(
    injector,
    () =>
      unsavedChangesDialogGuard(
        component,
        mock<ActivatedRouteSnapshot>(),
        mock<RouterStateSnapshot>(),
        mock<RouterStateSnapshot>(),
      ) as Promise<boolean>,
  );
}
