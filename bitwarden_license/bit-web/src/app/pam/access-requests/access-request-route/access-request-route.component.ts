import { Location } from "@angular/common";
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
 * empty shell or an unrelated tab. Closing the dialog leaves the URL — a dismissed dialog must not
 * stay addressable — by going back to wherever the caller came from, or to `/pam` when they
 * arrived cold (a pasted or emailed link has no history to return to).
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
  private readonly location = inject(Location);

  private readonly navigation = this.router.getCurrentNavigation();

  /**
   * Whether to return the caller to where they came from when the dialog closes, read off the
   * in-flight navigation during construction. It holds only while the `/pam` shell is already
   * mounted: on a cold load the shell is created during this same activation and its outlet has
   * not registered yet, so Angular defers this component to a later change-detection pass, by
   * which point the router has dropped the navigation and this reads `false`. That is the right
   * answer for a cold load and the safe answer for any other deferred entry — an unrecognised
   * caller is sent to the shell rather than back out of the app.
   */
  private readonly hasHistory = this.navigation?.previousNavigation != null;

  /**
   * The tab to render behind the dialog. Rows on all three tabs link here, so the backdrop follows
   * the caller rather than assuming My requests — an approver opening a row from the Approvals
   * inbox would otherwise watch the list swap to their own requests and swap back on close.
   */
  protected readonly originTab = tabFrom(this.navigation?.previousNavigation?.finalUrl);

  ngOnInit(): void {
    const dialogRef = AccessRequestDialogComponent.open(this.dialogService, {
      detail: this.detail,
    });

    // The ref reports every close the same way, including the one this component performs on its
    // way out, so leaving the route has to be told apart from the caller dismissing the dialog —
    // otherwise a back-button close sends the browser back twice.
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
      if (this.hasHistory) {
        this.location.back();
      } else {
        void this.router.navigate(["/pam"]);
      }
    });
  }
}

/**
 * The tab a URL addresses, read off its last path segment so it holds wherever the PAM routes are
 * mounted. Anything else — including a caller from outside `/pam` and a cold load with no previous
 * URL at all — falls back to My requests, the shell's own default tab.
 */
function tabFrom(url: UrlTree | undefined): OriginTab {
  const segments = url?.root.children[PRIMARY_OUTLET]?.segments ?? [];
  const last = segments[segments.length - 1]?.path;
  return last === "approvals" || last === "history" ? last : "my-requests";
}
