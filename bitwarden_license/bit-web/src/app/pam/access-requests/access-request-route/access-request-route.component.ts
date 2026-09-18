import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { PRIMARY_OUTLET, Router, UrlTree } from "@angular/router";

import { DialogService } from "@bitwarden/components";

import { ApprovalsTabComponent } from "../approvals-tab.component";
import { HistoryTabComponent } from "../history-tab.component";
import { MyRequestsTabComponent } from "../my-requests-tab.component";

import { AccessRequestDetailService } from "./access-request-detail.service";
import { AccessRequestDialogComponent } from "./access-request-dialog.component";

/** The tabs that link to a request row, and so the surfaces the dialog can be opened over. */
type OriginTab = "approvals" | "history" | "my-requests";

/**
 * `/pam/requests/:id` — the shareable link to one access request. Every row links here, and both
 * the requester's and the approvers' emails deep-link here, so the URL is load-bearing and stays
 * a real route.
 *
 * The detail is a dialog over the access-requests shell, not a page of its own: a child of the
 * shell route, so the header and tab bar stay put, and closing it REPLACES the URL with the
 * origin tab rather than pushing — a dismissed dialog must not stay addressable or stack on top
 * of one the caller can still reach with Back.
 *
 * {@link AccessRequestDetailService} is provided here, not on the route config, since it reads
 * `:id` off `ActivatedRoute`, which a route-level provider can't see; it reaches the dialog
 * through `DIALOG_DATA` for the same reason.
 */
@Component({
  selector: "app-pam-access-request-route",
  templateUrl: "./access-request-route.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AccessRequestDetailService],
  imports: [ApprovalsTabComponent, HistoryTabComponent, MyRequestsTabComponent],
})
export class AccessRequestRouteComponent implements OnInit {
  private readonly detail = inject(AccessRequestDetailService);
  private readonly dialogService = inject(DialogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  /**
   * The tab the caller navigated from — read off the in-flight navigation, so an approver opening
   * a row keeps the Approvals inbox behind it rather than watching it swap to My requests.
   *
   * Absent on a cold load: the shell's own activation defers this component past when the router
   * has dropped the navigation.
   */
  private readonly navigatedFrom = tabFrom(
    this.router.getCurrentNavigation()?.previousNavigation?.finalUrl,
  );

  private readonly viewer = toSignal(this.detail.viewer$, { initialValue: null });
  private readonly loading = toSignal(this.detail.loading$, { initialValue: true });

  /**
   * The tab to render behind the dialog, and the one closing it returns to. With no tab to go
   * back to, it follows who is viewing: an approver arriving from the email lands on Approvals,
   * the requester on My requests.
   *
   * Undefined until the viewer is known, so nothing renders rather than My requests being swapped
   * out from under an approver; closing before then returns to My requests. A load that settles
   * without a request (missing, not visible, or failed) has no viewer to follow, and falls back
   * to My requests.
   */
  protected readonly originTab = computed<OriginTab | undefined>(() => {
    if (this.navigatedFrom != null) {
      return this.navigatedFrom;
    }
    const viewer = this.viewer();
    if (viewer != null) {
      return viewer === "approver" ? "approvals" : "my-requests";
    }
    return this.loading() ? undefined : "my-requests";
  });

  ngOnInit(): void {
    const dialogRef = AccessRequestDialogComponent.open(this.dialogService, {
      detail: this.detail,
    });

    // The ref reports every close the same way; leaving the route must be told apart from a
    // dismissal, or navigating away fires a second close.
    let leaving = false;

    this.destroyRef.onDestroy(() => {
      leaving = true;
      void dialogRef.close();
    });

    dialogRef.closed.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (leaving) {
        return;
      }
      leaving = true;
      void this.router.navigate(["/pam", this.originTab() ?? "my-requests"], { replaceUrl: true });
    });
  }
}

/**
 * The tab a URL addresses, matched on the whole `/pam/<tab>` shape, not just the trailing
 * segment — `history` is also the last segment of the billing routes. Undefined for anything else.
 */
function tabFrom(url: UrlTree | undefined): OriginTab | undefined {
  const segments = url?.root.children[PRIMARY_OUTLET]?.segments.map((s) => s.path) ?? [];
  if (segments.length !== 2 || segments[0] !== "pam") {
    return undefined;
  }
  const tab = segments[1];
  return tab === "approvals" || tab === "history" || tab === "my-requests" ? tab : undefined;
}
