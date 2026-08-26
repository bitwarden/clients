import { TestBed } from "@angular/core/testing";
import {
  ActivatedRouteSnapshot,
  GuardResult,
  Router,
  RouterStateSnapshot,
  UrlSegment,
} from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, isObservable } from "rxjs";

import { SyncService } from "@bitwarden/common/platform/sync";

import { ApprovalPrivilegeService } from "./approval-privilege.service";
import { canViewApprovalsGuard } from "./can-view-approvals.guard";

/** A snapshot whose `pathFromRoot` spells out `segments`, as the router builds it. */
function snapshotFor(segments: string[]): ActivatedRouteSnapshot {
  return {
    pathFromRoot: segments.map((path) => ({ url: [new UrlSegment(path, {})] })),
  } as unknown as ActivatedRouteSnapshot;
}

describe("canViewApprovalsGuard", () => {
  let canApprove$: BehaviorSubject<boolean>;
  let syncService: { getLastSync: jest.Mock; fullSync: jest.Mock };
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
    // What the privilege IS lives in `approval-privileges.spec.ts`; this spec only cares that the
    // guard routes on the answer.
    canApprove$ = new BehaviorSubject<boolean>(true);
    syncService = {
      getLastSync: jest.fn().mockResolvedValue(new Date()),
      fullSync: jest.fn().mockResolvedValue(true),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: ApprovalPrivilegeService, useValue: { canApprove$ } },
        { provide: SyncService, useValue: syncService },
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

  it("syncs before deciding when nothing has synced yet", async () => {
    // The privilege comes from synced collection state; deciding first would bounce a real approver
    // on a cold deep link.
    syncService.getLastSync.mockResolvedValue(null);

    expect(await run()).toBe(true);
    expect(syncService.fullSync).toHaveBeenCalled();
  });

  it("does not re-sync when a sync has already landed", async () => {
    expect(await run()).toBe(true);
    expect(syncService.fullSync).not.toHaveBeenCalled();
  });

  it("redirects a non-approver to My requests", async () => {
    canApprove$.next(false);

    await run();

    expect(router.createUrlTree).toHaveBeenCalledWith(["/", "pam", "my-requests"]);
  });

  it("redirects rather than blocking, so a bookmarked tab is not a dead end", async () => {
    canApprove$.next(false);

    expect(await run()).not.toBe(false);
  });

  it("rebuilds the redirect from the matched path, so it survives being mounted elsewhere", async () => {
    canApprove$.next(false);

    await run(["organizations", "org-1", "pam", "approvals"]);

    expect(router.createUrlTree).toHaveBeenCalledWith([
      "/",
      "organizations",
      "org-1",
      "pam",
      "my-requests",
    ]);
  });
});
