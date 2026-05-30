import { ChangeDetectionStrategy, Component, OnInit, inject } from "@angular/core";
import { Router } from "@angular/router";

/**
 * Route handler for `/leasing/requests/:id` deep links from email.
 *
 * The user is guaranteed authenticated and unlocked when this component
 * renders: `authGuard` redirects unauthenticated/locked users away, and
 * `deepLinkGuard` rehydrates the original URL after unlock. The job here
 * is to forward the approver to the inbox (PM-37268). Per-request focus on
 * the deep-linked id is a separate ApproverInbox feature not yet wired.
 */
@Component({
  selector: "pam-access-request-route",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessRequestRouteComponent implements OnInit {
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    await this.router.navigate(["/pam/approver-inbox"], { replaceUrl: true });
  }
}
