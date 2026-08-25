import { TestBed } from "@angular/core/testing";
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  provideRouter,
  Route,
  RouterStateSnapshot,
  UrlTree,
} from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { GovModeService } from "@bitwarden/common/platform/abstractions/gov-mode.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { ToastService } from "@bitwarden/components";

import { routes } from "./oss-routing.module";

/** Depth-first search for every route with the given path. */
function findRoutes(candidates: Route[], path: string): Route[] {
  return candidates.flatMap((route) => [
    ...(route.path === path ? [route] : []),
    ...findRoutes(route.children ?? [], path),
  ]);
}

describe("oss routing", () => {
  // Self-serve organization creation is blocked on the Gov cloud (PM-40490). These assertions pin
  // the guard wiring by running each route's canActivate entries with Gov mode on: dropping the
  // canActivate entry — or registering the factory uncalled, which Angular would treat as the
  // guard and silently fail open — must fail this suite.
  describe.each([
    "create-organization",
    "add-plan",
    "trial-initiation",
    "secrets-manager-trial-initiation",
  ])("%s route", (path) => {
    beforeEach(() => {
      const govModeService = mock<GovModeService>();
      govModeService.isGovMode$.mockReturnValue(of(true));
      govModeService.globalIsGovMode$ = of(true);

      const accountService = mock<AccountService>();
      accountService.activeAccount$ = of({ id: "user-id" as UserId } as never);

      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          { provide: GovModeService, useValue: govModeService },
          { provide: AccountService, useValue: accountService },
          { provide: ToastService, useValue: mock<ToastService>() },
          { provide: LogService, useValue: mock<LogService>() },
          { provide: I18nService, useValue: mock<I18nService>() },
        ],
      });
    });

    it("is blocked in Gov mode", async () => {
      const matches = findRoutes(routes, path);
      expect(matches.length).toBeGreaterThan(0);

      for (const route of matches) {
        const guards = (route.canActivate ?? []) as CanActivateFn[];
        expect(guards.length).toBeGreaterThan(0);

        // Sibling guards (e.g. unauthGuardFn on the trial routes) may fail on providers this
        // harness doesn't supply — treat those as non-answers; only govModeBlockedGuard must
        // produce the blocking UrlTree.
        const results = await Promise.all(
          guards.map(async (guard) => {
            try {
              return await TestBed.runInInjectionContext(() =>
                guard({} as ActivatedRouteSnapshot, { url: `/${path}` } as RouterStateSnapshot),
              );
            } catch {
              return null;
            }
          }),
        );

        expect(results.some((result) => result instanceof UrlTree)).toBe(true);
      }
    });
  });
});
