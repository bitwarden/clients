import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ToastService } from "@bitwarden/components";
import { InboxLeaseRequestResponse, PamApiService } from "@bitwarden/pam";

import { EmailApprovalComponent } from "../email-approval/email-approval.component";

/**
 * Route handler for `/leasing/requests/:id` deep links from email.
 *
 * Auth-state dispatch:
 *  - LoggedOut  → Angular redirects via deepLinkGuard (persists URL) + authGuard; never reaches here.
 *  - Locked     → Renders the locked-vault approval-only surface (no vault decryption).
 *  - Unlocked   → Redirects to the full approver-inbox detail (PM-37268).
 *
 * This component deliberately imports nothing from CipherService or vault
 * decryption paths. The only data rendered is server-supplied display
 * metadata from the inbox endpoint (cipher name, collection name, requester
 * info) — never decrypted Vault Data.
 */
@Component({
  selector: "pam-leasing-request-route",
  templateUrl: "./leasing-request-route.component.html",
  imports: [CommonModule, JslibModule, EmailApprovalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeasingRequestRouteComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly pamApiService = inject(PamApiService);
  private readonly accountService = inject(AccountService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);

  protected readonly loading = signal<boolean>(true);
  protected readonly loadError = signal<boolean>(false);
  protected readonly request = signal<InboxLeaseRequestResponse | null>(null);

  protected readonly currentUserId = toSignal(
    this.accountService.activeAccount$.pipe(map((a) => a?.id ?? null)),
    { initialValue: null },
  );

  async ngOnInit(): Promise<void> {
    const requestId: string = this.route.snapshot.params["id"];

    const authStatus = await this.authService.getAuthStatus();

    if (authStatus === AuthenticationStatus.Unlocked) {
      await this.router.navigate(["/pam/approver-inbox"], {
        queryParams: { requestId },
        replaceUrl: true,
      });
      return;
    }

    try {
      const req = await this.pamApiService.getLeaseRequest(requestId);
      this.request.set(req);
    } catch (e) {
      this.logService.error(e);
      this.loadError.set(true);
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("emailApprovalLoadFailed"),
      });
    } finally {
      this.loading.set(false);
    }
  }
}
