import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { combineLatest, concatMap, distinctUntilChanged, filter, map, take } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  DialogService,
  DrawerRef,
  TabsModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import { hasApprovalPrivileges$ } from "../approvals/approval-privileges";
import { ApproverInboxService } from "../approvals/approver-inbox.service";

import { AccessRequestRouteComponent } from "./access-request-route/access-request-route.component";
import { MyAccessService } from "./my-access.service";

/**
 * "Access requests" (`/pam`) — the persistent tabbed shell over the caller's access surface:
 *  - Approvals — other members' requests awaiting the caller's decision. Hidden entirely for a
 *    member with no approval privileges, rather than shown empty: a tab that can never have anything
 *    in it is noise, and `canViewApprovalsGuard` redirects the deep link to match.
 *  - My requests — the caller's own pending/extension requests and active leases.
 *  - History — the caller's terminal requests, plus (for approvers) the ones they decided. No
 *    berry: {@link MyAccessService.historyRows$} only grows (terminal requests never leave
 *    history), so a live count there would read as permanent unattended work rather than
 *    something to act on — unlike the My requests and Approvals berries below.
 *
 * Each tab is a child route rendered in the shell's `<router-outlet>`; the shell stays mounted
 * across tab navigation. {@link MyAccessService} is provided at the parent route (see the routing
 * module) so every tab shares one loaded instance — this shell owns the single load and the
 * load-failure toast, and renders the tab nav with live berry counts. {@link ApproverInboxService} is
 * provided the same way and loaded the same way, but only for a caller who can actually approve:
 * hitting the approver endpoints for everyone would mean two guaranteed-empty requests per page open.
 * View concerns (the countdown clock, action gating) live in the individual tabs.
 *
 * The shell also owns the request drawer: a `requestId` query param names the request showing in
 * {@link AccessRequestRouteComponent}, so a row link only has to add the param and the reader stays
 * on their own tab. Closing the drawer clears the param with `replaceUrl`, which is what stops
 * browser Back walking through every request that was opened.
 */
@Component({
  selector: "pam-access-requests",
  templateUrl: "./access-requests.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterModule, HeaderModule, TabsModule, TypographyModule, I18nPipe],
})
export class AccessRequestsComponent implements OnInit {
  private readonly myAccess = inject(MyAccessService);
  private readonly inbox = inject(ApproverInboxService);
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly logService = inject(LogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);

  /** The drawer currently showing a request, and the id it was opened for. */
  private readonly drawerRef = signal<DrawerRef<undefined> | undefined>(undefined);
  private readonly openRequestId = signal<string | null>(null);

  /**
   * The "My requests" berry: everything the caller still holds or can act on — pending requests,
   * open extension requests, and active leases. Zero renders no berry (see `bit-tab-link`).
   */
  protected readonly myRequestsCount = toSignal(
    combineLatest([
      this.myAccess.pendingRows$,
      this.myAccess.extensionRows$,
      this.myAccess.leases$,
    ]).pipe(
      map(([pending, extensions, leases]) => pending.length + extensions.length + leases.length),
    ),
    { initialValue: 0 },
  );

  private readonly approvalPrivileges$ = hasApprovalPrivileges$(
    this.accountService,
    this.organizationService,
  );

  /** Whether to render the Approvals tab at all. */
  protected readonly canApprove = toSignal(this.approvalPrivileges$, { initialValue: false });

  /** The "Approvals" berry: requests awaiting the caller's decision. */
  protected readonly approvalsCount = toSignal(this.inbox.pendingCount$, { initialValue: 0 });

  ngOnInit(): void {
    void this.myAccess.load();

    // Only an approver has anything to load here, and the inbox/history endpoints would otherwise be
    // called on every page open for members who can never see a row. Driven off the stream rather
    // than `canApprove()`, which is still on its initial `false` at this point: the privilege depends
    // on an organization lookup that has not resolved yet.
    this.approvalPrivileges$
      .pipe(filter(Boolean), take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.inbox.load());

    this.inbox.loadError$
      .pipe(
        filter((e) => e != null),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => {
        this.logService.error(e);
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("pamInboxLoadFailed"),
        });
      });

    this.myAccess.loadError$
      .pipe(
        filter((e) => e != null),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => {
        this.logService.error(e);
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("pamMyRequestsLoadError"),
        });
      });

    this.route.queryParams
      .pipe(
        map((params) => (typeof params.requestId === "string" ? params.requestId : null)),
        distinctUntilChanged(),
        // concatMap, not switchMap: two rapid id changes must not interleave two opens and leave
        // the stack describing a request the URL no longer names.
        concatMap((requestId) => this.syncDrawer(requestId)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    // Leaving /pam entirely destroys the shell but not the drawer: closeOnNavigation is off, so
    // nothing else would tear it down. Clearing drawerRef first stops the closed handler writing
    // query params onto the route the user just navigated to.
    this.destroyRef.onDestroy(() => void this.forgetDrawer()?.close());
  }

  /** Drop the shell's hold on the drawer and hand it back, so the caller can close it. */
  private forgetDrawer(): DrawerRef<undefined> | undefined {
    const ref = this.drawerRef();
    this.drawerRef.set(undefined);
    this.openRequestId.set(null);
    return ref;
  }

  private async syncDrawer(requestId: string | null): Promise<void> {
    if (requestId === this.openRequestId()) {
      return;
    }
    if (requestId == null) {
      await this.forgetDrawer()?.close();
      return;
    }

    this.openRequestId.set(requestId);
    // openDrawer() closes whatever is on the stack first, and that drawer's `closed` fires while
    // the new one is opening. Dropping the reference now is what makes the guard in the closed
    // handler below reject it, so the outgoing drawer cannot wipe the id the incoming one needs.
    this.drawerRef.set(undefined);
    const ref = await AccessRequestRouteComponent.openDrawer(this.dialogService, { requestId });
    if (ref == null) {
      this.openRequestId.set(null);
      return;
    }
    this.drawerRef.set(ref);

    ref.closed.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.drawerRef() !== ref) {
        return;
      }
      this.forgetDrawer();
      // No `relativeTo`: an empty command array keeps the whole current path, so closing the
      // drawer leaves the reader on the tab they opened it from.
      void this.router.navigate([], {
        queryParams: { requestId: null },
        queryParamsHandling: "merge",
        replaceUrl: true,
      });
    });
  }
}
