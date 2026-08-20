import { TestBed } from "@angular/core/testing";
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from "@angular/router";
import { BehaviorSubject, Observable, firstValueFrom, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { canViewApprovalsGuard } from "./can-view-approvals.guard";

describe("canViewApprovalsGuard", () => {
  // A route snapshot whose matched path ends in `approvals`, mimicking the end-user inbox mount.
  const route = {
    pathFromRoot: [
      { url: [{ path: "pam" }, { path: "approver-inbox" }] },
      { url: [{ path: "approvals" }] },
    ],
  } as unknown as ActivatedRouteSnapshot;
  const state = {} as RouterStateSnapshot;

  const setup = (canManageAccessRules: boolean) => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AccountService,
          useValue: { activeAccount$: new BehaviorSubject({ id: "user-1" }) },
        },
        {
          provide: OrganizationService,
          useValue: { organizations$: () => of([{ canManageAccessRules }]) },
        },
      ],
    });
  };

  const run = () =>
    firstValueFrom(
      TestBed.runInInjectionContext(() => canViewApprovalsGuard(route, state)) as Observable<
        boolean | UrlTree
      >,
    );

  it("allows users who can manage access rules in some organization", async () => {
    setup(true);
    await expect(run()).resolves.toBe(true);
  });

  it("redirects users without approval privileges to the my-requests tab", async () => {
    setup(false);

    const result = await run();

    expect(result).toBeInstanceOf(UrlTree);
    const router = TestBed.inject(Router);
    expect(router.serializeUrl(result as UrlTree)).toBe("/pam/approver-inbox/my-requests");
  });
});
