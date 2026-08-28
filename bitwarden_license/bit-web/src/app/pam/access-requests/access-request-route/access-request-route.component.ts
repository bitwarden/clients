import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
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
 * `/pam/requests/:id` — the shareable link to one of the caller's own requests. Every row links
 * here, and an emailed deep link lands here, so the URL is load-bearing and stays a real route
 * rather than a click handler on the rows.
 *
 * The detail itself is a dialog over the access-requests shell, not a page of its own: this
 * component is a child of the shell route, so the header and tab bar stay put, and it renders the
 * tab the caller left underneath so the backdrop shows the list they were reading rather than an
 * empty shell or an unrelated tab. Closing the dialog replaces this URL with that same tab — a
 * dismissed dialog must not stay addressable, and replacing consumes the entry rather than
 * stacking the tab on top of a dialog the caller can still land back on with Back. The cost is a
 * repeated entry behind a warm caller, whose first Back press then looks idle; the alternative,
 * stepping the browser back instead, has no way to tell an entry this app pushed from the one a
 * pasted link opened the tab on, and strands the caller on a dismissed dialog when it guesses
 * wrong.
 *
 * {@link AccessRequestDetailService} is provided here rather than on the route config because it
 * reads the `:id` off `ActivatedRoute`, which route-level providers cannot see (they resolve in the
 * route's environment injector, where `ActivatedRoute` falls through to the root route). It is
 * handed to the dialog through `DIALOG_DATA` for the same reason.
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
   * The tab to render behind the dialog, and the one closing it returns to. Rows on all three tabs
   * link here, so the backdrop follows the caller rather than assuming My requests — an approver
   * opening a row from the Approvals inbox would otherwise watch the list swap to their own
   * requests and swap back on close.
   *
   * Read off the in-flight navigation during construction, which is absent on a cold load: the
   * shell is created by that same activation and its outlet has not registered yet, so Angular
   * defers this component to a later change-detection pass, by which point the router has dropped
   * the navigation. My requests — the shell's own default tab — is the answer then.
   */
  protected readonly originTab = tabFrom(
    this.router.getCurrentNavigation()?.previousNavigation?.finalUrl,
  );

  ngOnInit(): void {
    const dialogRef = AccessRequestDialogComponent.open(this.dialogService, {
      detail: this.detail,
    });

    // The ref reports every close the same way, including the one this component performs on its
    // way out, so leaving the route has to be told apart from the caller dismissing the dialog —
    // otherwise being navigated away would fire a second close navigation of its own.
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
      void this.router.navigate(["/pam", this.originTab], { replaceUrl: true });
    });
  }
}

/**
 * The tab a URL addresses, matched on the whole `/pam/<tab>` shape rather than the trailing segment
 * alone: `history` is also the last segment of the organization and provider billing routes, and
 * this route is built to be deep-linked into from outside. Anything else — including a caller from
 * elsewhere in the app and a cold load with no previous URL at all — falls back to My requests, the
 * shell's own default tab.
 */
function tabFrom(url: UrlTree | undefined): OriginTab {
  const segments = url?.root.children[PRIMARY_OUTLET]?.segments.map((s) => s.path) ?? [];
  if (segments.length !== 2 || segments[0] !== "pam") {
    return "my-requests";
  }
  const tab = segments[1];
  return tab === "approvals" || tab === "history" ? tab : "my-requests";
}
