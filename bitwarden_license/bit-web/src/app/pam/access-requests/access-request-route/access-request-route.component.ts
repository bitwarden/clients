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
 * Hosts the `/pam/requests/:id` dialog over the shell. Closing replaces the URL with the origin
 * tab, so a dismissed dialog isn't left addressable. {@link AccessRequestDetailService} is
 * provided here since a route-level provider can't read `:id`.
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
   * The tab the caller navigated from, so an approver opening a row keeps the Approvals inbox
   * behind it. Absent on a cold load.
   */
  private readonly navigatedFrom = tabFrom(
    this.router.getCurrentNavigation()?.previousNavigation?.finalUrl,
  );

  private readonly viewer = toSignal(this.detail.viewer$, { initialValue: null });
  private readonly loading = toSignal(this.detail.loading$, { initialValue: true });

  /**
   * The tab behind the dialog, and the one closing returns to. Without an origin it follows the
   * viewer, staying undefined until the viewer is known so My requests isn't swapped out from
   * under an approver.
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

    // Leaving the route also closes the dialog, and that close must not navigate a second time.
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
 * Matches the whole `/pam/<tab>` shape, since `history` is also the last segment of the billing
 * routes.
 */
function tabFrom(url: UrlTree | undefined): OriginTab | undefined {
  const segments = url?.root.children[PRIMARY_OUTLET]?.segments.map((s) => s.path) ?? [];
  if (segments.length !== 2 || segments[0] !== "pam") {
    return undefined;
  }
  const tab = segments[1];
  return tab === "approvals" || tab === "history" || tab === "my-requests" ? tab : undefined;
}
