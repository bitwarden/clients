import { TestBed } from "@angular/core/testing";
import {
  ActivatedRouteSnapshot,
  GuardResult,
  Router,
  RouterStateSnapshot,
  UrlSegment,
} from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, isObservable, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserId } from "@bitwarden/common/types/guid";

import { canViewApprovalsGuard } from "./can-view-approvals.guard";

const approverOrg = { canManageAccessRules: true } as Organization;
const memberOrg = { canManageAccessRules: false } as Organization;

/** A snapshot whose `pathFromRoot` spells out `segments`, as the router builds it. */
function snapshotFor(segments: string[]): ActivatedRouteSnapshot {
  return {
    pathFromRoot: segments.map((path) => ({ url: [new UrlSegment(path, {})] })),
  } as unknown as ActivatedRouteSnapshot;
}

describe("canViewApprovalsGuard", () => {
  let organizations$: BehaviorSubject<Organization[]>;
  let router: Router;

  /**
   * Runs the guard in an injection context and normalises its result to a promise.
   *
   * The guard is typed `CanActivateFn`, so call sites must pass both `route` and `state` even though
   * this implementation ignores the second one. Static analysis reads the arrow function's arity
   * rather than the annotation and flags the argument as superfluous — it is not, and dropping it
   * fails the build with TS2554.
   */
  async function run(segments = ["pam", "approvals"]): Promise<GuardResult> {
    const result = TestBed.runInInjectionContext(() =>
      canViewApprovalsGuard(snapshotFor(segments), mock<RouterStateSnapshot>()),
    );
    return isObservable(result) ? await firstValueFrom(result) : await result;
  }

  beforeEach(() => {
    organizations$ = new BehaviorSubject<Organization[]>([approverOrg]);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: AccountService,
          useValue: { activeAccount$: of({ id: "user-1" as UserId }) },
        },
        { provide: OrganizationService, useValue: { organizations$: () => organizations$ } },
        {
          provide: Router,
          useValue: { createUrlTree: jest.fn((commands: unknown[]) => commands as never) },
        },
      ],
    });
    router = TestBed.inject(Router);
  });

  it("lets an approver through", async () => {
    expect(await run()).toBe(true);
  });

  it("is satisfied by the privilege in ANY organization, not the one in the URL", async () => {
    // The Access requests page is user-global, so it spans every organization the user belongs to.
    organizations$.next([memberOrg, approverOrg]);

    expect(await run()).toBe(true);
  });

  it("redirects a member with no approval privileges to My requests", async () => {
    organizations$.next([memberOrg]);

    await run();

    expect(router.createUrlTree).toHaveBeenCalledWith(["/", "pam", "my-requests"]);
  });

  it("redirects rather than blocking, so a bookmarked tab is not a dead end", async () => {
    organizations$.next([memberOrg]);

    expect(await run()).not.toBe(false);
  });

  it("rebuilds the redirect from the matched path, so it survives being mounted elsewhere", async () => {
    organizations$.next([memberOrg]);

    await run(["organizations", "org-1", "pam", "approvals"]);

    expect(router.createUrlTree).toHaveBeenCalledWith([
      "/",
      "organizations",
      "org-1",
      "pam",
      "my-requests",
    ]);
  });

  it("redirects a user who belongs to no organization at all", async () => {
    organizations$.next([]);

    await run();

    expect(router.createUrlTree).toHaveBeenCalled();
  });
});
