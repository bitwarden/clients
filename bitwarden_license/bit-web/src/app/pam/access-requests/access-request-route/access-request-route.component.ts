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
 * here, and an emailed deep link lands here, so the URL is load-bearing and stays a real route.
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
   * The tab to render behind the dialog, and the one closing it returns to — read off the
   * in-flight navigation, so an approver opening a row keeps the Approvals inbox behind it rather
   * than watching it swap to My requests.
   *
   * Absent on a cold load: the shell's own activation defers this component past when the router
   * has dropped the navigation, so My requests is the fallback.
   */
  protected readonly originTab = tabFrom(
    this.router.getCurrentNavigation()?.previousNavigation?.finalUrl,
  );

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
      void this.router.navigate(["/pam", this.originTab], { replaceUrl: true });
    });
  }
}

/**
 * The tab a URL addresses, matched on the whole `/pam/<tab>` shape, not just the trailing
 * segment — `history` is also the last segment of the billing routes. Falls back to My requests,
 * the shell's own default, for anything else.
 */
function tabFrom(url: UrlTree | undefined): OriginTab {
  const segments = url?.root.children[PRIMARY_OUTLET]?.segments.map((s) => s.path) ?? [];
  if (segments.length !== 2 || segments[0] !== "pam") {
    return "my-requests";
  }
  const tab = segments[1];
  return tab === "approvals" || tab === "history" ? tab : "my-requests";
}
