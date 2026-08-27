import { Location } from "@angular/common";
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";

import { DialogService } from "@bitwarden/components";

import { MyRequestsTabComponent } from "../my-requests-tab.component";

import { AccessRequestDetailService } from "./access-request-detail.service";
import { AccessRequestDialogComponent } from "./access-request-dialog.component";

/**
 * `/pam/requests/:id` — the shareable link to one of the caller's own requests. Every row links
 * here, and an emailed deep link lands here, so the URL is load-bearing and stays a real route
 * rather than a click handler on the rows.
 *
 * The detail itself is a dialog over the access-requests shell, not a page of its own: this
 * component is a child of the shell route, so the header and tab bar stay put, and it renders the
 * My requests tab underneath so the backdrop shows the surface the request belongs to rather than
 * an empty shell. Closing the dialog leaves the URL — a dismissed dialog must not stay addressable
 * — by going back to wherever the caller came from, or to `/pam` when they arrived cold (a pasted
 * or emailed link has no history to return to).
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
  imports: [MyRequestsTabComponent],
})
export class AccessRequestRouteComponent implements OnInit {
  private readonly detail = inject(AccessRequestDetailService);
  private readonly dialogService = inject(DialogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  /**
   * Whether the caller reached this URL from somewhere else in the app. Read during construction,
   * while the router still holds the in-flight navigation: a cold load (pasted link, new tab, the
   * planned approval deep link) is the initial navigation and has no previous one to go back to.
   */
  private readonly hasHistory = this.router.getCurrentNavigation()?.previousNavigation != null;

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
